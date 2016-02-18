var jsforce = require('jsforce');
var _ = require('lodash');
var Q = require('q');
var express = require('express');

var router = express.Router();
var jExt;

module.exports = function(io) {
    
    //TODO: Implement socket.io
    
    router.use(function(req, res, next) {
        
        var connectionDetails = {
            accessToken: req.headers.accesstoken,
            instanceUrl: req.headers.instanceurl
        };
        
        var JsforceExt = require('../../lib/jsforceExt');
        
        jExt = new JsforceExt(connectionDetails, io);
        
        next();
    });
    
    router.route('/testclasses').get(function(req, res, next) {
        var fieldNames = ['Id', 'Name'];
        jExt.getTestClasses(fieldNames).then(function(result) {
            
            //Stripping off the "attributes" property for now.
            var strippedResult = _.map(result, function(record) {
                return _.pick(record, fieldNames);
            });
            
            //var suffix = (strippedResult.length !== 1) ? 'es' : '';
            //io.emit('message', 'Found ' + strippedResult.length + ' test class' + suffix + '.');
            
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
    
    return router;
}