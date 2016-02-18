var jsforce = require('jsforce');
var Q = require('q');
var _ = require('lodash');

/**
 * Constructor, example usage:
 * var jsforceConn = require('./api/jsforceConn');
 * 
 * //Pass in the connection details object
 * var conn = new jsforceConn({ accessToken: '123456...', instanceUrl: 'https://xx.salesforce.com' });
 */
function jsforceExt(connectionDetails, io) {
    
    var jsforceConn = new jsforce.Connection(connectionDetails);
    jsforceConn.bulk.pollTimeout = process.env.JSFORCE_POLLING_TIMEOUT || 60000;
    
    this.conn = jsforceConn;
    //this.io = io;
} 

jsforceExt.prototype.getTestClasses = function(fieldNames) {
    fieldNames = fieldNames || ['Id', 'Name'];
    return this.conn.search("FIND {@isTest} IN ALL FIELDS RETURNING ApexClass(" + fieldNames.join(',') + " WHERE NamespacePrefix = null ORDER BY Name ASC)");
}

jsforceExt.prototype.createTraceFlag = function(userId) {

	var defer = Q.defer();
    var conn = this.conn;
    //var io = this.io;

	//The Analytics class in Salesforce spits out debug statements with the logging level set to 'ERROR'.
	//This is to keep the debug log as small as possible.
	var traceFlag = {
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
	conn.tooling.query("Select Id From TraceFlag Where CreatedById = '" + userId + "'").then(function(flags) {
		
		//print('sobject:TraceFlag - jsforceConn.tooling.query() flags =>', flags, 3);
		var traceFlagIds = _.pick(flags.records, 'Id');

		//var message = (traceFlagIds.length > 0) ? 'Found ' + traceFlagIds.length + ' existing trace flags to be deleted' : 'No existing trace flags found';
		//print(message + ' =>', traceFlagIds);
        //io.emit('message', message);

		//This del request will fail silently if there are no existing trace flags to delete so this is safe to do.
		return conn.tooling.sobject('TraceFlag').del(traceFlagIds);

	}).then(function(res) {
		
		//print('sobject:TraceFlag - jsforceConn.tooling.sobject().del() res =>', res, 3);
		return conn.tooling.sobject('TraceFlag').create(traceFlag);

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

jsforceExt.prototype.getTestRunStatus = function(asyncApexJobId, io) {
    
    var conn = this.conn;
    //var io = this.io;
    var defer = Q.defer();
	var outputMessage;

    function run(asyncApexJobId) {

        conn.query("SELECT Id, Status FROM ApexTestQueueItem WHERE ParentJobId = '" + asyncApexJobId + "'").then(function(res) {

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

module.exports = jsforceExt;