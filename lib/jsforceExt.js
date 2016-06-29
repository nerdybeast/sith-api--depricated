'use strict';

let jsforce = require('jsforce');
let Promise = require('bluebird');
let _ = require('lodash');
let moment = require('moment');
let request = require('request');
let serializer = require('jsonapi-serializer').Serializer;
let cache = require('./cache');
let extractAnalytics = require('./extract-analytics');
let customSerializer = require('./json-api-serializer');
let Debug = require('./debug');
let db = require('./db');

let _debug = new Debug('JSFORCE_EXT');

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
        
        _debug.log(`Found ${result.size} existing traceflags`);
        
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

		_debug.log('TraceFlag res =>', res);
        
        return Promise.resolve(res);

	}).catch((err) => {
		
        if(err.errorCode === 'FIELD_INTEGRITY_EXCEPTION') {
            
            _debug.log('Trace Flag Creation Error', err);
            return Promise.resolve();
            
        } else {
            return Promise.reject(err);
        }
        
	});
}

jsforceExt.prototype.triggerAsyncTestRun = function(testClassIds) {
    
    const apexTestQueueItemType = 'ApexTestQueueItem';
    const asyncApexJobType = 'AsyncApexJob';
    
    let apexTestQueueItemFieldNames;
    let asyncApexJobFieldNames;
    let asyncApexJobId;
    
    return Promise.all([
        this.getSobjectFieldNames(apexTestQueueItemType),
        this.getSobjectFieldNames(asyncApexJobType),
        this.conn.tooling.runTestsAsynchronous(testClassIds)
    ]).then((result) => {
        
        apexTestQueueItemFieldNames = result[0];
        asyncApexJobFieldNames = result[1];
        
        //This will be the id of the "AsyncApexJob" record that was created for this test run. All the "ApexTestQueueItem" records
        //that are created will point to this id in the "ParentJobId" field.
        asyncApexJobId = result[2];
        
        _debug.log(`${apexTestQueueItemType} field names => ${apexTestQueueItemFieldNames.join(', ')}`);
        _debug.log(`AsyncApexJob Id created for this test run`, asyncApexJobId);
        
        return Promise.all([
            this.conn.query(`SELECT ${apexTestQueueItemFieldNames.join(',')} FROM ${apexTestQueueItemType} WHERE ParentJobId = '${asyncApexJobId}'`),
            this.conn.query(`SELECT ${asyncApexJobFieldNames.join(',')} FROM ${asyncApexJobType} WHERE Id = '${asyncApexJobId}'`)
        ]);
        
    }).then(function(result) {
        
        let apexTestQueueItemRecords = _camelizeObjectArray(result[0].records); 
        let asyncApexJobRecords = _camelizeObjectArray(result[1].records);
        
        return {
            apexTestQueueItem: {
                sobjectType: apexTestQueueItemType,
                fieldNames: apexTestQueueItemFieldNames,
                records: apexTestQueueItemRecords
            },
            asyncApexJob: {
                sobjectType: asyncApexJobType,
                fieldNames: asyncApexJobFieldNames,
                records: asyncApexJobRecords
            }
        }
    });
}

jsforceExt.prototype.getTestRunStatus = function(asyncApexJobId) {
    
    const sobjectType = 'ApexTestQueueItem';
	let outputMessage;
    let apexTestQueueItemFieldNames;
    let completed = { 'status': 'Completed' };
    
    //Will hold the ApexTestQueueItem records that are queried in this function so that we can track the difference each time we poll below.
    let pollingQueue = [];
    
    //Will hold all of the tests that have been processed (debug log downloaded and parsed).
    let processQueue = [];
    
    let run = (asyncApexJobId) => {

        this.conn.query(`SELECT ${apexTestQueueItemFieldNames.join(',')} FROM ${sobjectType} WHERE ParentJobId = '${asyncApexJobId}'`).then((res) => {

            //camelCase all the properties in this response.
            let records = _camelizeObjectArray(res.records);

            //Will contain only the modified ApexTestQueueItem records, this helps limit the number of broadcasts to the client.
            let modifiedRecords = _getModifiedRecords(records, pollingQueue);
            
            //Now that the changed records have been captured, reset the queue to the current records state so that the next poll will capture additional changes.
            pollingQueue = records;
            
            //Simple filter to hold all of the test classes that have completed.
            let completedTests = _.filter(records, completed);
            
            //Will contain the completed records that need to be processed.
            let recordsToProcess = _getModifiedRecords(completedTests, processQueue);
            
            //Now that the records to process have been captured, reset the process queue.
            processQueue = completedTests;
            
            let tempMessage = `Tests completed: ${completedTests.length}/${res.totalSize}`;
            
            if(outputMessage !== tempMessage) {
                outputMessage = tempMessage;
                _debug.log(outputMessage);
            }

            //Will be true if all tests are in a completed state.
            let isCompleted = _.every(records, completed);

            //Will be true if there are changes that need to be broadcast to the client.
            if(modifiedRecords.length > 0) { 
                this.io.emit('test-status', { sobjectType, records: modifiedRecords, isCompleted });
            }

            //Will be true if there are new test results that need to be processed.
            if(recordsToProcess.length > 0) {
                
                //Will be an array of ids for all the completed tests.
                let completedApexTestQueueItemIds = _.map(recordsToProcess, 'id'); 
                
                //Will process the test results by downloading debug logs and extracting analytics.
                this._processTestResult(completedApexTestQueueItemIds, asyncApexJobId);
            }

            if(isCompleted) {
                _debug.log('Test run complete');
                return;
            }
            
            setTimeout(() => run(asyncApexJobId), 3000);

        }).catch((err) => {
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
    
    _debug.log(`"${sobject}" cached field names => ${cachedFieldNames.join(', ')}`);
    
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
            
            _debug.log(`"${sobject}" field names => ${fieldNames.join(', ')}`);
            
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
        
            //Query to find out if this DebugLevel record already exists in the current org.
            return this.conn.tooling.query(`SELECT ${fieldNames.join(',')} FROM DebugLevel WHERE DeveloperName = '${debugLevelName}'`);
            
        }).then((res) => {
            
            _debug.log('DebugLevel query response', res);
            
            //Will be true if the needed DebugLevel record already exists and if so, return the id.
            if(res.size === 1) {
                return resolve(res.records[0].Id);
            }
            
            //Reaching this point means that the needed DebugLevel record does not exist and we need to create it.
            let debugLevel = this._coreLoggingLevels;
            debugLevel.DeveloperName = debugLevelName;
            debugLevel.MasterLabel = debugLevelName;
                
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

jsforceExt.prototype.getDebugLogById = function(id) {
    
    return new Promise((resolve, reject) => {
        
        let url = `${this._connectionDetails.instanceUrl}/services/data/v${this._connectionDetails.version}/tooling/sobjects/ApexLog/${id}/Body`;
        _debug.log('ApexLog url', url);
        
        let headers = {
            'Authorization': `Bearer ${this._connectionDetails.accessToken}`
        };
        _debug.log('ApexLog request headers', headers);
        
        request.get({ url, headers }, (err, res, body) => {
            
            if(err) {
                return reject(err);
            }
            
            return resolve({ id, body});
        });
         
    });
}

jsforceExt.prototype.getOrgLimits = function() {
    
    return new Promise((resolve, reject) => {
        
        let url = `${this._connectionDetails.instanceUrl}/services/data/v${this._connectionDetails.version}/limits`;
        _debug.log('getOrgLimits url', url);
        
        let headers = {
            'Authorization': `Bearer ${this._connectionDetails.accessToken}`
        };
        
        request.get({ url, headers, json: true }, (err, res, body) => {
            
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
            
            _debug.log('Cached Describe "regularSobjectNames" found', cachedDescribe.regularSobjectNames.length);
            _debug.log('Cached Describe "toolingSobjectNames" found', cachedDescribe.toolingSobjectNames.length);
            
            return resolve(cachedDescribe);
        }
        
        Promise.all([
            this.conn.describeGlobal(), 
            this.conn.tooling.describeGlobal()
        ]).then((result) => {
            
            let regularSobjectNames = _.map(result[0].sobjects, 'name');
            let toolingSobjectNames = _.map(result[1].sobjects, 'name');
            
            _debug.log('Describe "regularSobjectNames" found', regularSobjectNames.length);
            _debug.log('Describe "toolingSobjectNames" found', toolingSobjectNames.length);
            
            let data = { regularSobjectNames, toolingSobjectNames };
            
            cache.set(cacheKey, data, (60 * 60 * 12));
            
            return resolve(data);
            
        }).catch((error) => {
            return reject(error);
        });
    });
}

jsforceExt.prototype._processTestResult = function(apexTestQueueItemIds, asyncApexJobId) {
    
    const apexTestResultType = 'ApexTestResult';
    const asyncApexJobType = 'AsyncApexJob';
    const apexLogType = 'ApexLog';
    
    let apexTestResultFieldNames;
    let asyncApexJobFieldNames;
    let apexLogFieldNames;
    
    Promise.all([
        this.getSobjectFieldNames(apexTestResultType),
        this.getSobjectFieldNames(asyncApexJobType),
        this.getSobjectFieldNames(apexLogType)
    ]).then((result) => {
        
        apexTestResultFieldNames = result[0];
        asyncApexJobFieldNames = result[1];
        apexLogFieldNames = result[2];
        
        return Promise.all([
            this.conn.query(`SELECT ${apexTestResultFieldNames.join(',')} FROM ${apexTestResultType} WHERE QueueItemId IN ('${apexTestQueueItemIds.join("','")}')`),
            this.conn.query(`SELECT ${asyncApexJobFieldNames.join(',')} FROM ${asyncApexJobType} WHERE Id = '${asyncApexJobId}'`)
        ]);
         
    }).then((result) => {
        
        let apexTestResultRecords = _camelizeObjectArray(result[0].records);
        let asyncApexJobRecords = _camelizeObjectArray(result[1].records);
        
        let apexTestResultData = customSerializer.apexTestResult(apexTestResultFieldNames, apexTestResultRecords);
        let asyncApexJobData = customSerializer.asyncApexJob(asyncApexJobFieldNames, asyncApexJobRecords);
        
        let combinedData = _.concat(apexTestResultData.data, asyncApexJobData.data);
        
        this.io.emit('process-test-results', { data: combinedData });
        
        let debugLogIds = _.uniq(_.map(apexTestResultRecords, 'apexLogId'));
        _debug.log(`Debug log ids => ${debugLogIds.join(', ')}`);
        
        let debugPromises = [];
        let apexLogQuery = `SELECT ${apexLogFieldNames.join(',')} FROM ${apexLogType} WHERE Id In ('${debugLogIds.join(`','`)}')`;
        _debug.log(`Apex Log query => ${apexLogQuery}`);

        //Add this query as the first element in this promise array, later retreive with result[0];
        debugPromises.push(this.conn.query(apexLogQuery));

        debugLogIds.forEach(id => debugPromises.push(this.getDebugLogById(id)));
        
        return Promise.all(debugPromises);
        
    }).then((res) => {
        
        let apexLogRecords = _camelizeObjectArray(res[0].records);
        let apexLogData = customSerializer.apexLog(apexLogFieldNames, apexLogRecords);
        this.io.emit('process-test-results', apexLogData);

        res.splice(0, 1);
        //res => [{ id:'1234', body:'Contents of debug log...'}, {...}]
        
        let allAnalytics = [];

        res.forEach((log) => {
            let analytics = extractAnalytics(log.body);
            _debug.log('Analytics found', analytics.length);
            
            //Sending this emit in a loop so that the front end knows which debug log these analytics were collected from.
            this.io.emit('analytics', {
                debugLogId: log.id,
                analytics
            });

            allAnalytics.push(analytics);
        });
        
        return db.bulkAnalyticUpload(_.flatten(allAnalytics));

    }).then(res => {
        _debug.log('Analytics upload to db res', res);
    });
    
}

function _camelizeObjectArray(collection) {
    return _.map(collection, function(obj) {
        return _.mapKeys(obj, function(value, key) {
            return _.camelCase(key);
        });
    });
}

function _getModifiedRecords(newRecords, oldRecords) {
    
    return _.filter(newRecords, (newRecord) => {
                
        let oldRecord = _.find(oldRecords, { id: newRecord.id });
        
        //Will be true if a change has been detected between the current record and its matching record in the queue.
        //This will be a record that we want to broadcast to the client.
        if(!_.isEqual(newRecord, oldRecord)) {
            return newRecord;
        }
    });
}

module.exports = jsforceExt;