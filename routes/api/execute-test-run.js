'use strict';

const express = require('express');
const _ = require('lodash');
const routeErrorHandler = require('../../lib/route-error-handler');
const customSerializer = require('../../lib/json-api-serializer');
const Debug = require('../../lib/debug');

let _debug = new Debug('EXECUTE_TEST_RUN');

let router = express.Router();

router.route('/').post(function(req, res, next) {
    
    let classIds = req.body.data.classIds || [];
    let userId = req.body.data.userId;
    let acceptsJsonApi = req.headers.acceptsJsonApi;
    let sf = req.app.get('sf');
    
    //TODO: need to see if creating a new traceflag here is going to interupt a test that is currently running.
    //If so, we will need to check for that before creating the new traceflag.
    return sf.createAnalyticsTraceFlag(userId).then(result => {
    
        _debug.log('Created TraceFlag', result);
    
        return sf.triggerAsyncTestRun(classIds);
        
    }).then(result => {
        
        let asyncApexJob = result.asyncApexJob.records[0];
        
        //This is a void return method that will continue to monitor the test run using socket.io
        sf.getTestRunStatus(asyncApexJob.id, userId);
        
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