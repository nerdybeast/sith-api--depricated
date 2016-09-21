'use strict';

const jsforce = require('jsforce');
const EventEmitter = require('events');
const _ = require('lodash');
const Promise = require('bluebird');
const moment = require('moment');
const cache = require('./redis-manager');
const Debug = require('./debug');

let _debug = new Debug('SALESFORCE');

class Salesforce extends EventEmitter {

    /**
     * connectionDetails => { accessToken: '', instanceUrl: '' }
     * user => { orgId: '', userId: '' }
     */
    constructor(connectionDetails, user) {

        //Invoke the EventEmitter constructor.
        super();

        let jsForceConnection = new jsforce.Connection(connectionDetails);
        
        //jsForce runs a poll operation on all of its bulk api methods and times out fairly quickly, here we are bumping up that time. 
        jsForceConnection.bulk.pollTimeout = process.env.JSFORCE_POLLING_TIMEOUT || 60000;
        
        //Store the jsForce connection on this extension object so that we have access to the original jsForce library.
        this.conn = jsForceConnection;

        //Store the connection details on this object for later reference.
        this._connectionDetails = connectionDetails;

        //NOTE: This is not an entire user profile
        this._user = user;

        /**
         * Will hold a user's existing trace flags that will be deleted during the test run. After the test run,
         * they will be restored and the temporary apex analytics trace flag will be deleted.
         */
        this._traceFlagMap = new Map();
    }

    /**
     * This set of logging levels will help keep the debug log as small as possible, ensuring we
     * are able to collect all of the anlytics injected during a test run.
     */
    static coreLoggingLevels() {
        return {
            ApexCode: 'ERROR',
            ApexProfiling: 'NONE',
            Callout: 'NONE',
            Database: 'NONE',
            System: 'NONE',
            Validation: 'NONE',
            Visualforce: 'NONE',
            Workflow: 'NONE'
        }
    }

    getAllClasses() {

        const cacheKey = `ORG_CLASSES:${this._user.orgId}`;

        return Promise.props({
            apexClassFieldNames: this.getSobjectFieldNames('ApexClass'),
            cachedClasses: cache.get(cacheKey)
        }).then(hash => {

            let records;

            //Need to remove the body field before executing the query, this field contains the entire class definition
            //which would make the data returned by this query absolutely huge.
            let fieldNames = _.without(hash.apexClassFieldNames, 'body', 'bodyCrc');

            if(hash.cachedClasses) { 
                records = hash.cachedClasses;
                _debug.log(`Cached org classes, found ${records.length}`);
                return { records, fieldNames };
            }

            let soql = `SELECT ${fieldNames.join(',')} FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name ASC`;

            return this.conn.query(soql).then(result => {

                records = _camelizeObjectArray(result.records);
                
                //Cache for 20 minutes
                return cache.set(cacheKey, records, (60 * 20));

            }).then(() => {
                return { records, fieldNames };
            });

        });
    }

    getTestClasses() {

        let fieldNames;

        return this.getSobjectFieldNames('ApexClass').then(apexClassFieldNames => {

            //Need to remove the body field before executing the query, this field contains the entire class definition
            //which would make the data returned by this query absolutely huge.
            fieldNames = _.without(apexClassFieldNames, 'body', 'bodyCrc');

            let sosl = `FIND {@isTest AND Analytics.getInstance} IN ALL FIELDS RETURNING ApexClass(${fieldNames.join(',')} WHERE NamespacePrefix = null ORDER BY Name ASC)`;

            //The FIND clause in a sosl query is case insensitive.
            return this.conn.search(sosl);

        }).then(records => {

            //Api version 37 changed this result from being an array to being an object with a "searchRecords" property that holds the array of records.
            //Look for the new version of the response and then fall back to the old way just in case.
            records = _camelizeObjectArray(records.searchRecords || records);

            return { records, fieldNames };
        });
    }

    getSobjectFieldNames(sobject) {

        const cacheKey = `SOBJECT_FIELD_NAMES:${this._user.orgId}:${sobject}`;
        
        return cache.get(cacheKey).then(cachedFieldNames => {

            if(cachedFieldNames) {
                
                _debug.log(`"${sobject}" cached field names => ${cachedFieldNames.join(', ')}`);

                return cachedFieldNames;
            }

            return this._isToolingSobject(sobject).then((isToolingSobject) => {
            
                return isToolingSobject ? this.conn.tooling.describe(sobject) : this.conn.describe(sobject);
                
            }).then(function(meta) {
            
                //Strip out all the values in the "name" field which will give us an array of just the sobject field names.
                let fieldNames = _.map(meta.fields, 'name');
                
                //At this point, all of the field names will be Capitalized which is not what we want
                fieldNames = _.map(fieldNames, function(fieldName) { 
                    
                    //camelCase the field name, example: "FirstName" becomes "firstName".
                    return _.camelCase(fieldName); 
                });
                
                _debug.log(`"${sobject}" field names => ${fieldNames.join(', ')}`);
                
                return Promise.props({
                    fieldNames,
                    cacheResult: cache.set(cacheKey, fieldNames, (60 * 60 * 12)) //cache for 12 hours
                });
                
            }).then(hash => {

                return hash.fieldNames;

            });

        });
    }

    getOrgLimits() {
        return this.conn.limits();
    }

    createAnalyticsTraceFlag(userId) {
        
        //Will hold the user's existing trace flags (we want to restore these when the test run is complete).
        let existingTraceFlags = [];

        return this.getSobjectFieldNames('TraceFlag').then(traceFlagFieldNames => {
            
            traceFlagFieldNames.push('debugLevel.developerName');

            return this.conn.tooling.query(`SELECT ${traceFlagFieldNames.join(',')} FROM TraceFlag WHERE CreatedById = '${userId}'`);
            
        }).then(result => {
            
            let count = result.size;
            _debug.log(`Found ${count} existing traceflag${count !== 1 ? 's' : ''} for user ${userId}.`);

            if(count > 0) {

                //Create a list of the user's existing trace flags excluding the apex analytics trace flag that is temporary during the test run.
                existingTraceFlags = _.filter(result.records, (record) => {
                    return record.DebugLevel.DeveloperName !== 'APEX_ANALYTICS';
                });
            }

            //Create an array of all the existing trace flag ids created for the current user id.
            let traceFlagIds = _.map(result.records, 'Id');
            
            //This del request will fail silently if there are no existing trace flags to delete so this is safe to do.
            return Promise.all([
                this.conn.tooling.sobject('TraceFlag').del(traceFlagIds),
                this.createDebugLevel()
            ]);
            
        }).then(result => {

            //The Analytics class in Salesforce spits out debug statements with the logging level set to 'ERROR'.
            //This is to keep the debug log as small as possible.
            let traceFlag = Salesforce.coreLoggingLevels();
            traceFlag.LogType = 'USER_DEBUG';
            traceFlag.DebugLevelId = result[1];
            traceFlag.TracedEntityId = userId;
            traceFlag.ExpirationDate = moment().add(12, 'hours');
            
            return this.conn.tooling.sobject('TraceFlag').create(traceFlag);

        }).then(result => {

            let analyticsTraceFlagId = result.id;
            _debug.log(`Created TraceFlag => ${analyticsTraceFlagId}`);

            this._traceFlagMap.set(userId, { analyticsTraceFlagId, existingTraceFlags });
            
            return Promise.resolve(result);

        }).catch(err => {
            
            if(err.errorCode === 'FIELD_INTEGRITY_EXCEPTION') {
                
                _debug.log('Trace Flag Creation Error', err);
                return Promise.resolve();
                
            } else {
                return Promise.reject(err);
            }
            
        });
    }

    createDebugLevel() {
        
        const debugLevelName = 'APEX_ANALYTICS';
        let existingDebugLevel = null;
        
        return new Promise((resolve, reject) => {
            
            this.getSobjectFieldNames('DebugLevel').then(fieldNames => {
            
                //Query to find out if this DebugLevel record already exists in the current org.
                return this.conn.tooling.query(`SELECT ${fieldNames.join(',')} FROM DebugLevel WHERE DeveloperName = '${debugLevelName}'`);
                
            }).then(res => {
                
                let coreLoggingLevels = Salesforce.coreLoggingLevels();
                let needToDelete = false;

                //Will be true if the needed DebugLevel record already exists and if so, return the id.
                if(res.size === 1) {
                    
                    existingDebugLevel = res.records[0];
                    
                    //Using the coreLoggingLevels we have defined in the constructor, let's pick those same keys off of this existing DebugLevel
                    //record so that we can compare the two to make sure they match.
                    let existingLoggingLevelValues = _.pick(existingDebugLevel, _.keys(coreLoggingLevels));
                    
                    //Will be true if the existing DebugLevel record is setup correctly
                    if(_.isEqual(existingLoggingLevelValues, coreLoggingLevels)) {
                        return resolve(existingDebugLevel.Id);
                    }

                    //Reaching this point means there is an existing DebugLevel record with the correct DeveloperName but it is not setup correctly.
                    needToDelete = true;
                }
                
                let debugLevel = coreLoggingLevels;
                debugLevel.DeveloperName = debugLevelName;
                debugLevel.MasterLabel = debugLevelName;
                
                if(needToDelete) {
                    
                    return this.conn.tooling.sobject('DebugLevel').del(existingDebugLevel.Id).then(deleteResult => {
                        
                        _debug.log('DebugLevel delete response', deleteResult);
                        
                        return this.conn.tooling.sobject('DebugLevel').create(debugLevel);
                    });
                }

                return this.conn.tooling.sobject('DebugLevel').create(debugLevel);

            }).then((res) => {
                
                _debug.log('DebugLevel create response', res);

                //Will be the id for the DebugLevel record that we just created.
                return resolve(res.id);
                
            }).catch((error) => {
                return reject(error);
            });
        });
    }

    _isToolingSobject(sobject) {

        return this._fullDescribe().then(result => {
        
            //Will be true if the given sobject is listed in the array of tooling sobject names.
            return !_.includes(result.regularSobjectNames, sobject);
        });
    }

    _fullDescribe() {

        const cacheKey = `GLOBAL_SOBJECT_DESCRIBE_BY_ORG:${this._user.orgId}`;
    
        return cache.get(cacheKey).then(cachedDescribe => {

            if(cachedDescribe) {
                
                _debug.log('Cached Describe "regularSobjectNames" found', cachedDescribe.regularSobjectNames.length);
                _debug.log('Cached Describe "toolingSobjectNames" found', cachedDescribe.toolingSobjectNames.length);
                
                return cachedDescribe;
            }

            return Promise.all([
                this.conn.describeGlobal(), 
                this.conn.tooling.describeGlobal()
            ]).then(result => {
                
                let regularSobjectNames = _.map(result[0].sobjects, 'name');
                let toolingSobjectNames = _.map(result[1].sobjects, 'name');
                
                _debug.log('Describe "regularSobjectNames" found', regularSobjectNames.length);
                _debug.log('Describe "toolingSobjectNames" found', toolingSobjectNames.length);
                
                let data = { regularSobjectNames, toolingSobjectNames };
                
                return Promise.props({
                    data,
                    cacheResult: cache.set(cacheKey, data, (60 * 60 * 12)) //cache for 12 hours
                });
                
            }).then(hash => {
                return hash.data;
            });

        });
    }
}

function _camelizeObjectArray(collection) {
    return _.map(collection, function(obj) {
        return _.mapKeys(obj, function(value, key) {
            return _.camelCase(key);
        });
    });
}

module.exports = Salesforce;