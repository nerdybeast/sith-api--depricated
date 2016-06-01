'use strict';

let express = require('express');
let _ = require('lodash');
let JsforceExt = require('../../lib/jsforceExt');
let routeErrorHandler = require('../../lib/route-error-handler');
let serializer = require('jsonapi-serializer').Serializer;

module.exports = function(io) {
    
    let router = express.Router();

    let jExt;

    router.use(function(req, res, next) {
        
        jExt = new JsforceExt({
            accessToken: req.headers.sessionid,
            instanceUrl: req.headers.instanceurl
        }, io);
        
        next();
    });

    router.route('/').post(function(req, res, next) {
        
        let classIds = req.body.data.classIds || [];
        let userId = req.body.data.userId;
        let acceptsJsonApi = req.headers.acceptsJsonApi;
        
        //TODO: need to see if creating a new traceflag here is going to interupt a test that is currently running.
        //If so, we will need to check for that before creating the new traceflag.
        return jExt.createTraceFlag(userId).then(result => {
        
            io.emit('debug-from-server', { traceFlag: result });
            console.log('SITH => create trace flag:', result);
        
            return jExt.triggerAsyncTestRun(classIds);
            
        }).then(result => {
            
            let asyncApexJob = result.asyncApexJob.records[0];
            
            //This is a void return method that will continue to monitor the test run using socket.io
            jExt.getTestRunStatus(asyncApexJob.id);
            
            if(acceptsJsonApi) {
                
                let apexTestQueueItemData = new serializer(result.apexTestQueueItem.sobjectType, { 
                    attributes: _.without(result.apexTestQueueItem.fieldNames, 'id')  
                }).serialize(result.apexTestQueueItem.records);
                
                let asyncApexJobData = new serializer(result.asyncApexJob.sobjectType, { 
                    attributes: _.without(result.asyncApexJob.fieldNames, 'id')  
                }).serialize(result.asyncApexJob.records);
                
                let combinedData = _.concat(apexTestQueueItemData.data, asyncApexJobData.data);
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

    return router;
}