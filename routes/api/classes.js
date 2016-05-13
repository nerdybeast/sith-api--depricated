'use strict';

var express = require('express');
var _ = require('lodash');
var JsforceExt = require('../../lib/jsforceExt');
var serializer = require('jsonapi-serializer').Serializer;

var router = express.Router();
var jExt;
 
var ClassSerializer = new serializer('classes', {
    attributes: ['name', 'apiVersion']
});

//This middleware function will be invoked for every request to a route contained in this file.
router.use(function(req, res, next) {
        
    let connectionDetails = {
        accessToken: req.headers.sessionid,
        instanceUrl: req.headers.instanceurl
    };
    
    jExt = new JsforceExt(connectionDetails, null);
    
    next();
});

router.route('/').get(function(req, res, next) {
    
    var fieldNames = ['Id', 'Name', 'ApiVersion'];
    
    jExt.getAllClasses(fieldNames).then(function(result) {
        
        var strippedResult = _.map(result.records, function(record) {
        
            //Stripping off the "attributes" property for now.
            var pickedRecord = _.pick(record, fieldNames);
            
            //Loop through the keys of the current record so that we can manipulate them.
            return _.mapKeys(pickedRecord, function(value, key) {
            
                //Here we need to dasherize the keys of this response payload to comply with the json api spec.
                //Example: turns "FirstName" into "first-name".
                //return _.kebabCase(key);
                return _.camelCase(key);
            });
        });
        
        //Turn our response into a json api document.
        var jsonApiData = ClassSerializer.serialize(strippedResult);
        
        return res.send(jsonApiData); 
        
    }).catch(function(error) {
        var exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(function(req, res, next) {
    next(new Error(`${req.method} not supported at ${req.originalUrl}`));
});

router.route('/istest').get(function(req, res, next) {
    
    var fieldNames = ['Id', 'Name'];
    
    jExt.getTestClasses(fieldNames).then(function(result) {
        
        //Stripping off the "attributes" property for now.
        var strippedResult = _.map(result, function(record) {
            return _.pick(record, fieldNames);
        });
        
        return res.send(strippedResult);
        
    }).catch(function(error) {
        var exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(function(req, res, next) {
    next(new Error(`${req.method} not supported at ${req.originalUrl}`));
});

module.exports = router;