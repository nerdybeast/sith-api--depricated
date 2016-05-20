'use strict';

let express = require('express');
let _ = require('lodash');
let JsforceExt = require('../../lib/jsforceExt');
let routeErrorHandler = require('../../lib/route-error-handler');
let serializer = require('jsonapi-serializer').Serializer;

let router = express.Router();

let jExt;

router.use(function(req, res, next) {
    
    jExt = new JsforceExt({
        accessToken: req.headers.sessionid,
        instanceUrl: req.headers.instanceurl
    }, null);
    
    next();
});

router.route('/').post(function(req, res, next) {
    
    let classIds = req.body.data.classIds || [];
    let userId = req.body.data.userId;
    
    return jExt.createTraceFlag(userId).then(function(result) {
      
        //Creates an "AsyncApexJob" record in Salesforce, we are given back just the id.
        //return jExt.conn.tooling.runTestsAsynchronous(classIds);
        
        return jExt.triggerAsyncTestRun(classIds);
        
    }).then(function(result) {
        
        //result => 7071700000XdKTp
        
        //TODO: Here we want to fire a void method that will continue monitoring the test run while this method returns immediately.
        //We will use socket.io to monitor the job and send updates.
        
        console.log('runTestsAsynchronous() result =>', result);
        
        //Must specify an empty attributes property in order for the json api doc to be generated correctly even though our response has no "attributes".
        let RunTestAsyncSerializer = new serializer(result.sobjectType, { 
            attributes: _.without(result.sobjectFieldNames, 'id')  
        });
        
        let jsonApiData = RunTestAsyncSerializer.serialize(result.records);
        
        return res.send(jsonApiData);
        
    }).catch(function(error) {
        var exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(routeErrorHandler);

module.exports = router;