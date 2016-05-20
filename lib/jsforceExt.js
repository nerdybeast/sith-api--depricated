'use strict';

let jsforce = require('jsforce');
let Q = require('q');
let _ = require('lodash');

/**
 * Constructor, example usage:
 * var jsforceConn = require('./api/jsforceConn');
 * 
 * //Pass in the connection details object
 * var conn = new jsforceConn({ accessToken: '123456...', instanceUrl: 'https://xx.salesforce.com' });
 */
function jsforceExt(connectionDetails, io) {
    
    let jsforceConn = new jsforce.Connection(connectionDetails);
    jsforceConn.bulk.pollTimeout = process.env.JSFORCE_POLLING_TIMEOUT || 60000;
    
    this.conn = jsforceConn;
    //this.io = io;
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
    
    let sosl = `FIND {@isTest} IN ALL FIELDS RETURNING ApexClass(${fieldNames.join(',')} WHERE NamespacePrefix = null ORDER BY Name ASC)`;
    
    //The FIND clause in a sosl query is case insensitive.
    return this.conn.search(sosl).then(function(records) {
        return _camelizeObjectArray(records);
    });
}

jsforceExt.prototype.createTraceFlag = function(userId) {

	let defer = Q.defer();
    let conn = this.conn;
    //var io = this.io;

	//The Analytics class in Salesforce spits out debug statements with the logging level set to 'ERROR'.
	//This is to keep the debug log as small as possible.
	let traceFlag = {
		//This property is available in v35 of the tooling api which is not yet supported by jsforce.
		//LogType: 'USER_DEBUG',
		
		ApexCode: 'ERROR',
		ApexProfiling: 'NONE',
		Callout: 'NONE',
		Database: 'NONE',
		System: 'NONE',
		Validation: 'NONE',
		Visualforce: 'NONE',
		Workflow: 'NONE',
		ScopeId: userId,
		TracedEntityId: userId
	};

	//Find all existing traceflags for the current user and delete them, other trace flags will interfere with the debug log output.
	conn.tooling.query(`SELECT Id FROM TraceFlag WHERE CreatedById = '${userId}'`).then((flags) => {
		
		//print('sobject:TraceFlag - jsforceConn.tooling.query() flags =>', flags, 3);
		let traceFlagIds = _.map(flags.records, 'Id');

		//var message = (traceFlagIds.length > 0) ? 'Found ' + traceFlagIds.length + ' existing trace flags to be deleted' : 'No existing trace flags found';
		//print(message + ' =>', traceFlagIds);
        //io.emit('message', message);

		//This del request will fail silently if there are no existing trace flags to delete so this is safe to do.
		return this.conn.tooling.sobject('TraceFlag').del(traceFlagIds);

	}).then((res) => {
		
		//print('sobject:TraceFlag - jsforceConn.tooling.sobject().del() res =>', res, 3);
		return this.conn.tooling.sobject('TraceFlag').create(traceFlag);

	}).then(function(res) {

		//print('createTraceFlag() res =>', res, 3);
		defer.resolve(res);

	}).catch(function(err) {
		
		//print('createTraceFlag() err =>', err, 3);
		
		if(err.errorCode === 'FIELD_INTEGRITY_EXCEPTION') {
			//print('Trace flag already created for the current user.');
            //io.emit('message', 'Trace flag already created for the current user.');
			defer.resolve();
		} else {
			defer.reject(err);
		}
	});

	return defer.promise;
}

jsforceExt.prototype.triggerAsyncTestRun = function(testClassIds) {
    
    let sobjectFieldNames;
    const sobjectType = 'ApexTestQueueItem';
    
    let promises = [
        this.getSobjectFieldNames(sobjectType),
        this.conn.tooling.runTestsAsynchronous(testClassIds)
    ];
    
    return Q.all(promises).then((result) => {
        
        sobjectFieldNames = result[0];
        let asyncJobId = result[1];
        
        return this.conn.query(`SELECT ${sobjectFieldNames.join(',')} FROM ${sobjectType} WHERE ParentJobId = '${asyncJobId}'`);
        
    }).then(function(result) {
        
        let records = _.map(result.records, function(record) {
            return _.mapKeys(record, function(value, key) {
                return _.camelCase(key);
            });
        });
        
        return { sobjectType, sobjectFieldNames, records };
    });
}

jsforceExt.prototype.getTestRunStatus = function(asyncApexJobId, io) {
    
    var conn = this.conn;
    //var io = this.io;
    var defer = Q.defer();
	var outputMessage;

    function run(asyncApexJobId) {

        conn.query(`SELECT Id, Status FROM ApexTestQueueItem WHERE ParentJobId = '${asyncApexJobId}'`).then(function(res) {

            var statuses = _.pick(res.records, 'Status');
            var numOfCompleted = _.filter(statuses, 'status', 'Completed');
            
            var tempMessage = 'Tests completed: ' + numOfCompleted.length + '/' + res.records.length;
            if(outputMessage !== tempMessage) {
                outputMessage = tempMessage;
                console.info('\n' + outputMessage);
                
                if(numOfCompleted.length !== res.records.length) {
                    console.log('Updating status, please wait...');
                }
            }			

            //Get a unique list of all the statuses. When the tests are done running, every status will be 'Completed' so this
            //variable should end up an array with one element.
            var groupedStatuses = _.uniq(statuses);

            if(groupedStatuses.length === 1 && groupedStatuses[0] === 'Completed') {

                console.log('Test run complete');
                defer.resolve(res);

            } else {
                setTimeout(function() {
                    run(asyncApexJobId);
                }, 5000);
            }

        }).catch(function(err) {
            console.error('getRunTestsStatus err => ', err);
            defer.reject(err);
        });

    }
        
    run(asyncApexJobId);

	return defer.promise;
} 

/**
 * @description Returns a camelCased list of field names that exist for the given sobject.
 */
jsforceExt.prototype.getSobjectFieldNames = function(sobject) {
	
    return this.conn.describe(sobject).then(function(meta) {
		
        let fieldNames = _.map(meta.fields, 'name');
        
        return _.map(fieldNames, function(fieldName) { 
            return _.camelCase(fieldName); 
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

module.exports = jsforceExt;