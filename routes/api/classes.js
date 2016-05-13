'use strict';

var express = require('express');
var _ = require('lodash');
var JsforceExt = require('../../lib/jsforceExt');
var serializer = require('jsonapi-serializer').Serializer;

var router = express.Router();
var jExt;

//Will hold the field names from our describe() call into salesforce, these names will be "CamelCased".
var fieldNames;
 
//Will hold our json api serializer for the "ApexClass" class in Salesforce.
var ClassSerializer;

//This middleware function will be invoked for every request to a route contained in this file.
router.use(function(req, res, next) {
        
    let connectionDetails = {
        accessToken: req.headers.sessionid,
        instanceUrl: req.headers.instanceurl
    };
    
    jExt = new JsforceExt(connectionDetails, null);
    
    //Our jsForce extension class exposes the original jsForce library via ".conn"
    jExt.conn.describe('ApexClass').then(function(meta) {
        
        //This is running a describe on the whole ApexClass class but we simply want just the field names.
        let allFieldNames = _.map(meta.fields, 'name');
        
        //Let's remove the body fields because they will contain the entire contents of the class which will make our response huge.
        fieldNames = _.without(allFieldNames, 'Body', 'BodyCrc');
        
        ClassSerializer = new serializer('classes', {
            
            /**
             * Here we need to strip of the "Id" field so that it doesn't end up in the "attributes" section of the json api document.
             * The id will automatically be added one node up from the "attributes" which is where we want it, example:
             * {
             *   "data": [
             *     {
             *       id: "01pG0000004GSM7IAO",
             *       type: "classes",
             *       attributes: {
             *         name: "AccountCreationBL",
             *         //...
             *         //We dont want the "id" to end up in this object as well.
             *       }
             *     }
             *   ]
             * }
             */
            attributes: _.map(_.without(fieldNames, 'Id'), function(key) {
                return _.camelCase(key);
            })
        });
        
        next();
    });
});

router.route('/').get(function(req, res, next) {
    
    jExt.getAllClasses(fieldNames).then(function(result) {
        
        let strippedResult = _.map(result.records, function(record) {
        
            //Stripping off the "attributes" property for now.
            let pickedRecord = _.pick(record, fieldNames);
            
            //Loop through the keys of the current record so that we can manipulate them.
            return _.mapKeys(pickedRecord, function(value, key) {
            
                //Here we need to dasherize the keys of this response payload to comply with the json api spec.
                //Example: turns "first-name", "FirstName", etc. into "firstName".
                return _.camelCase(key);
            });
        });
        
        //console.log('strippedResult', strippedResult);
        
        //Turn our response into a json api document.
        let jsonApiData = ClassSerializer.serialize(strippedResult);
        
        return res.send(jsonApiData); 
        
    }).catch(function(error) {
        let exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(function(req, res, next) {
    next(new Error(`${req.method} not supported at ${req.originalUrl}`));
});

router.route('/istest').get(function(req, res, next) {
    
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