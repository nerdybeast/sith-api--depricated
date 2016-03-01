'use strict';

var express = require('express');
var _ = require('lodash');
var JsforceExt = require('../../lib/jsforceExt');

var router = express.Router();
var jExt;

//This middleware function will be invoked for every request to a route contained in this file.
router.use(function(req, res, next) {
        
    let connectionDetails = {
        accessToken: req.headers.accesstoken,
        instanceUrl: req.headers.instanceurl
    };
    
    jExt = new JsforceExt(connectionDetails, null);
    
    next();
});

router.route('/').get(function(req, res, next) {
    
    var fieldNames = ['Id', 'Name'];
    
    jExt.getAllClasses(fieldNames).then(function(result) {
        
        //Stripping off the "attributes" property for now.
        var strippedResult = _.map(result.records, function(record) {
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