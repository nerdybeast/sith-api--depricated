'use strict';

let jsforce = require('jsforce');
let Promise = require('bluebird');
let Q = require('q');
let _ = require('lodash');
let moment = require('moment');
let request = require('request');
let cache = require('./cache');
let extractAnalytics = require('./extract-analytics');
let customSerializer = require('./json-api-serializer');

/**
 * Constructor, example usage:
 * var jsforceConn = require('./api/jsforceConn');
 * 
 * //Pass in the connection details object
 * var conn = new jsforceConn({ accessToken: '123456...', instanceUrl: 'https://xx.salesforce.com' });
 */
function jsforceExt(connectionDetails, io) {
    
    //Set the api version we want jsforce to use.
    connectionDetails.version = '36.0';
    
    let jsforceConn = new jsforce.Connection(connectionDetails);
    
    //jsForce runs a poll operation on all of its bulk api methods and times out fairly quickly, here we are bumping up that time. 
    jsforceConn.bulk.pollTimeout = process.env.JSFORCE_POLLING_TIMEOUT || 60000;
    
    //Store the jsForce connection on this extension object so that we have access to the original jsForce library.
    this.conn = jsforceConn;
    
    //Store the websocket object so that messages can be broadcast to the connected clients.
    this.io = io;
    
    //Store the connection details on this object for later reference.
    this._connectionDetails = connectionDetails;
    
    //These are the logging levels needed to keep the debug logs as small as possible. 
    this._coreLoggingLevels = {
        ApexCode: 'ERROR',
        ApexProfiling: 'NONE',
        Callout: 'NONE',
        Database: 'NONE',
        System: 'NONE',
        Validation: 'NONE',
        Visualforce: 'NONE',
        Workflow: 'NONE'
    };
} 

jsforceExt.prototype.getAllClasses = function(fieldNames) {
    
    //Default to just these fields if specific field names are not supplied.
    fieldNames = fieldNames || ['id', 'name'];
    
    let soql = `SELECT ${fieldNames.join(',')} FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name ASC`;
    
    return this.conn.query(soql).then(function(result) {
        return _camelizeObjectArray(result.records);
    });
}

jsforceExt.prototype.getTestClasses = function(fieldNames) {
    
    //Default to just these fields if specific field names are not supplied.
    fieldNames = fieldNames || ['id', 'name'];
    
    let sosl = `FIND {@isTest AND Analytics.getInstance} IN ALL FIELDS RETURNING ApexClass(${fieldNames.join(',')} WHERE NamespacePrefix = null ORDER BY Name ASC)`;
    
    //The FIND clause in a sosl query is case insensitive.
    return this.conn.search(sosl).then(function(records) {
        return _camelizeObjectArray(records);
    });
}

jsforceExt.prototype.createTraceFlag = function(userId) {

    //const traceFlagCacheKey = `TRACE_FLAG_ID:${userId}`;
    //let cachedTraceFlagId = cache.get(traceFlagCacheKey);
    //let shouldCreateNewTraceFlag;

    return this.getSobjectFieldNames('TraceFlag').then((traceFlagFieldNames) => {
        
        return this.conn.tooling.query(`SELECT ${traceFlagFieldNames.join(',')} FROM TraceFlag WHERE CreatedById = '${userId}'`)
        
    }).then((result) => {
        
        _debug(`Found ${result.size} existing traceflags`);
        
        //Create an array of all the existing trace flag ids created for the current user id.
        let traceFlagIds = _.map(result.records, 'Id');
        
        //This del request will fail silently if there are no existing trace flags to delete so this is safe to do.
        return Promise.all([
            this.conn.tooling.sobject('TraceFlag').del(traceFlagIds),
            this.createDebugLevel()
        ]);
        
    }).then((res) => {
		
        //The Analytics class in Salesforce spits out debug statements with the logging level set to 'ERROR'.
        //This is to keep the debug log as small as possible.
        let traceFlag = this._coreLoggingLevels;
        traceFlag.LogType = 'USER_DEBUG';
        traceFlag.DebugLevelId = res[1];
        traceFlag.TracedEntityId = userId;
        traceFlag.ExpirationDate = moment().add(12, 'hours');
        
		return this.conn.tooling.sobject('TraceFlag').create(traceFlag);

	}).then((res) => {

		_debug('TraceFlag res =>', res);
        
        return Promise.resolve(res);

	}).catch((err) => {
		
        if(err.errorCode === 'FIELD_INTEGRITY_EXCEPTION') {
            
            _debug('Trace Flag Creation Error', err);
            return Promise.resolve();
            
        } else {
            return Promise.reject(err);
        }
        
	});
}

jsforceExt.prototype.triggerAsyncTestRun = function(testClassIds) {
    
    let sobjectFieldNames;
    let asyncApexJobId;
    const sobjectType = 'ApexTestQueueItem';
    
    return Q.all([
        this.getSobjectFieldNames(sobjectType),
        this.conn.tooling.runTestsAsynchronous(testClassIds)
    ]).then((result) => {
        
        sobjectFieldNames = result[0];
        
        _debug(`${sobjectType} field names => ${sobjectFieldNames.join(', ')}`);
        
        //This will be the id of the "AsyncApexJob" record that was created for this test run. All the "ApexTestQueueItem" records
        //that are created will point to this id in the "ParentJobId" field.
        asyncApexJobId = result[1];
        
        _debug(`AsyncApexJob Id created for this test run`, asyncApexJobId);
        
        return this.conn.query(`SELECT ${sobjectFieldNames.join(',')} FROM ${sobjectType} WHERE ParentJobId = '${asyncApexJobId}'`);
        
    }).then(function(result) {
        
        let records = _camelizeObjectArray(result.records);
        
        return { sobjectType, sobjectFieldNames, records, asyncApexJobId };
    });
}

jsforceExt.prototype.getTestRunStatus = function(asyncApexJobId) {
    
	let outputMessage;
    let apexTestQueueItemFieldNames;
    
    let run = (asyncApexJobId) => {

        this.conn.query(`SELECT ${apexTestQueueItemFieldNames.join(',')} FROM ApexTestQueueItem WHERE ParentJobId = '${asyncApexJobId}'`).then((res) => {

            res.records = _camelizeObjectArray(res.records);

            let completed = { 'status': 'Completed' };
            let completedTests = _.filter(res.records, completed);
            
            let tempMessage = `Tests completed: ${completedTests.length}/${res.totalSize}`;
            
            if(outputMessage !== tempMessage) {
                
                outputMessage = tempMessage;
                
                console.log(`\n${outputMessage}`);
                
                if(completedTests.length !== res.totalSize) {
                    console.log('Test still in progress, please wait...');
                }
                
                if(completedTests.length > 0) {
                    this._processTestResult(_.map(completedTests, 'id'));
                }
            }

            //Will be true if all tests are in a completed state.
            let allTestsCompleted = _.every(res.records, completed);

            //TODO: Only push the records that have changed when they change, this will significantly reduce the number of emits as well as the size of the message.
            //Possible use of _.isEqual 
            this.io.emit('test-status', {
                sobjectType: 'ApexTestQueueItem',
                records: res.records,
                isCompleted: allTestsCompleted
            });

            if(allTestsCompleted) {

                console.log('Test run complete');
                return;

            } else {
                setTimeout(function() {
                    run(asyncApexJobId);
                }, 3000);
            }

        }).catch(function(err) {
            console.error('getRunTestsStatus err => ', err);
            return;
        });

    }
    
    this.getSobjectFieldNames('ApexTestQueueItem').then((fieldNames) => {
        apexTestQueueItemFieldNames = fieldNames;
        run(asyncApexJobId);
    });
} 

/**
 * @description Returns a camelCased list of field names that exist for the given sobject.
 */
jsforceExt.prototype.getSobjectFieldNames = function(sobject) {
	
    const cacheKey = `SOBJECT_FIELD_NAMES:${sobject}`;
    let cachedFieldNames = cache.get(cacheKey) || [];
    
    _debug(`"${sobject}" cached field names => ${cachedFieldNames.join(', ')}`);
    
    return new Promise((resolve, reject) => {
    
        if(cachedFieldNames.length > 0) {
            return resolve(cachedFieldNames);
        }
        
        this._isToolingSobject(sobject).then((isToolingSobject) => {
           
            return isToolingSobject ? this.conn.tooling.describe(sobject) : this.conn.describe(sobject);
            
        }).then(function(meta) {
		
            //Strip out all the values in the "name" field which will give us an array of just the sobject field names.
            let fieldNames = _.map(meta.fields, 'name');
            
            //At this point, all of the field names will be Capitalized which is not what we want
            fieldNames = _.map(fieldNames, function(fieldName) { 
                
                //camelCase the field name, example: "FirstName" becomes "firstName".
                return _.camelCase(fieldName); 
            });
            
            _debug(`"${sobject}" field names => ${fieldNames.join(', ')}`);
            
            //Cache these field names for 12 hours
            cache.set(cacheKey, fieldNames, (60 * 60 * 12));
            
            return resolve(fieldNames);
            
        }).catch((error) => {
            return reject(error);
        }); 
    });
}

/**
 * Returns the id of the created DebugLevel record.
 */
jsforceExt.prototype.createDebugLevel = function() {
    
    const debugLevelName = 'APEX_ANALYTICS';
    
    return new Promise((resolve, reject) => {
        
        this.getSobjectFieldNames('DebugLevel').then((fieldNames) => {
        
            return this.conn.tooling.query(`SELECT ${fieldNames.join(',')} FROM DebugLevel WHERE DeveloperName = '${debugLevelName}'`);
            
        }).then((res) => {
            
            _debug('DebugLevel query response', res);
            
            if(res.size === 1) {
                return resolve(res.records[0].Id);
            }
            
            return this.conn.tooling.sobject('DebugLevel').create({
                ApexCode: 'ERROR',
                ApexProfiling: 'NONE',
                Callout: 'NONE',
                Database: 'NONE',
                DeveloperName: debugLevelName,
                MasterLabel: debugLevelName,
                System: 'NONE',
                Validation: 'NONE',
                Visualforce: 'NONE',
                Workflow: 'NONE'
            });
            
        }).then((res) => {
            
            _debug('DebugLevel create response', res);
            
            return resolve(res.id);
        }).catch((error) => {
            return reject(error);
        });
    });
}

jsforceExt.prototype.getDebugLogById = function(id) {
    
    return new Promise((resolve, reject) => {
        
        let url = `${this._connectionDetails.instanceUrl}/services/data/v${this._connectionDetails.version}/tooling/sobjects/ApexLog/${id}/Body`;
        _debug('ApexLog url', url);
        
        let headers = {
            'Authorization': `Bearer ${this._connectionDetails.accessToken}`
        };
        _debug('ApexLog request headers', headers);
        
        request.get({ url, headers }, (err, res, body) => {
            
            if(err) {
                return reject(err);
            }
            
            return resolve(body);
        });
         
    });
}

jsforceExt.prototype._isToolingSobject = function(sobjectName) {
    
    return this._fullDescribe().then((result) => {
        
        //Will be true if the given sobject is listed in the array of tooling sobject names.
        return !_.includes(result.regularSobjectNames, sobjectName);
    });
}

/**
 * @description 
 */
jsforceExt.prototype._fullDescribe = function() {
    
    const cacheKey = 'FULL_SOBJECT_DESCRIBE_BY_TYPE';
    let cachedDescribe = cache.get(cacheKey);
    
    return new Promise((resolve, reject) => {
       
        if(cachedDescribe) {
            
            _debug('Cached Describe "regularSobjectNames" found', cachedDescribe.regularSobjectNames.length);
            _debug('Cached Describe "toolingSobjectNames" found', cachedDescribe.toolingSobjectNames.length);
            
            return resolve(cachedDescribe);
        }
        
        Promise.all([
            this.conn.describeGlobal(), 
            this.conn.tooling.describeGlobal()
        ]).then((result) => {
            
            let regularSobjectNames = _.map(result[0].sobjects, 'name');
            let toolingSobjectNames = _.map(result[1].sobjects, 'name');
            
            _debug('Describe "regularSobjectNames" found', regularSobjectNames.length);
            _debug('Describe "toolingSobjectNames" found', toolingSobjectNames.length);
            
            let data = { regularSobjectNames, toolingSobjectNames };
            
            cache.set(cacheKey, data, (60 * 60 * 12));
            
            return resolve(data);
            
        }).catch((error) => {
            return reject(error);
        });
    });
}

jsforceExt.prototype._processTestResult = function(apexTestQueueItemIds) {
    
    const sobjectType = 'ApexTestResult';
    
    this.getSobjectFieldNames(sobjectType).then((fieldNames) => {
        
        return this.conn.query(`SELECT ${fieldNames.join(',')} FROM ${sobjectType} WHERE QueueItemId IN ('${apexTestQueueItemIds.join("','")}')`);
         
    }).then((res) => {
        
        res.records = _camelizeObjectArray(res.records);
        
        if(res.totalSize > 0) {
            _debug(`Example ${sobjectType} record`, res.records[0]);
        }
        
        this.io.emit('test-result', {
            sobjectType,
            records: res.records
        });
        
        let debugLogIds = _.uniq(_.map(res.records, 'apexLogId'));
        _debug(`Debug log ids => ${debugLogIds.join(', ')}`);
        
        let debugPromises = [];
        debugLogIds.forEach(id => debugPromises.push(this.getDebugLogById(id)));
        
        return Promise.all(debugPromises);
        
    }).then((res) => {
        
        res.forEach((log) => {
            _debug('Analytics found', extractAnalytics(log));
        });
        
    });
    
}

function _camelizeObjectArray(collection) {
    return _.map(collection, function(obj) {
        return _.mapKeys(obj, function(value, key) {
            return _.camelCase(key);
        });
    });
}

function _debug(message, obj) {
    
    console.log('----------------------------------------------------------------');
    
    let prefix = `JSFORCE_EXT: ${message}`
    
    if(obj !== undefined) {
        console.log(`${prefix} =>`, obj);
    } else {
        console.log(prefix);
    }
}

module.exports = jsforceExt;