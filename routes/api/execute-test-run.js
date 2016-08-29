'use strict';

let express = require('express');
let _ = require('lodash');
let serializer = require('jsonapi-serializer').Serializer;
let JsforceExt = require('../../lib/jsforceExt');
let routeErrorHandler = require('../../lib/route-error-handler');
let customSerializer = require('../../lib/json-api-serializer');
let Debug = require('../../lib/debug');

let _debug = new Debug('EXECUTE_TEST_RUN');

let router = express.Router();
let jExt;
let io;

router.route('/').post(function(req, res, next) {
    
    let classIds = req.body.data.classIds || [];
    let userId = req.body.data.userId;
    let acceptsJsonApi = req.headers.acceptsJsonApi;
    let jExt = req.app.get('jExt');
    
    //TODO: need to see if creating a new traceflag here is going to interupt a test that is currently running.
    //If so, we will need to check for that before creating the new traceflag.
    return jExt.createAnalyticsTraceFlag(userId).then(result => {
    
        //io.emit('debug-from-server', { traceFlag: result });
        _debug.log('Created TraceFlag', result);
    
        return jExt.triggerAsyncTestRun(classIds);
        
    }).then(result => {
        
        let asyncApexJob = result.asyncApexJob.records[0];
        
        //This is a void return method that will continue to monitor the test run using socket.io
        jExt.getTestRunStatus(asyncApexJob.id, userId);
        
        if(acceptsJsonApi) {
            
            let apexTestQueueItemData = customSerializer.apexTestQueueItem(result.apexTestQueueItem.fieldNames, result.apexTestQueueItem.records);
            let asyncApexJobData = customSerializer.asyncApexJob(result.asyncApexJob.fieldNames, result.asyncApexJob.records);
            let apexTestRunResultData = customSerializer.apexTestRunResult(result.apexTestRunResult.fieldNames, result.apexTestRunResult.records);
            
            let combinedData = _.concat(apexTestQueueItemData.data, asyncApexJobData.data, apexTestRunResultData.data);
            return res.send({ data: combinedData });
        }
        
        //Standard json response does not need to include the fieldNames array, ditch those arrays before returning.
        delete result.apexTestQueueItem.fieldNames;
        delete result.asyncApexJob.fieldNames;
        return res.send(result);
        
    }).catch(function(error) {
        var exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(routeErrorHandler);

module.exports = router;