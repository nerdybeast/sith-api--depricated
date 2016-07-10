'use strict';

const Q = require('q');
const express = require('express');
const _ = require('lodash');
const serializer = require('jsonapi-serializer').Serializer;
const JsforceExt = require('../../lib/jsforceExt');
const routeErrorHandler = require('../../lib/route-error-handler');
const Debug = require('../../lib/debug');

let _debug = new Debug('CLASSES');
let router = express.Router();

//Will hold an instance of our extended jsforce module.
let jExt;

//Will hold the field names from our describe() call into salesforce, these names will be "CamelCased".
let fieldNames;
 
//Will hold our json api serializer for the "ApexClass" class in Salesforce.
let ClassSerializer;

//This middleware function will be invoked for every request made to a route defined in this file.
router.use(function(req, res, next) {
    
    let io = req.app.get('io');

    let connectionDetails = {
        accessToken: req.headers.sessionid,
        instanceUrl: req.headers.instanceurl
    };

    let profile = {
        userId: req.headers.userId,
        orgId: req.headers.orgId
    }; 

    jExt = new JsforceExt(connectionDetails, profile, io);
    
    jExt.getSobjectFieldNames('ApexClass').then(function(fieldNamesResult) {
        
        //Let's remove the body fields because they will contain the entire contents of the class which will make our response huge.
        fieldNames = _.without(fieldNamesResult, 'body', 'bodyCrc');
        
        _debug.log(`ApexClass field names => ${fieldNames.join(', ')}`);
        
        /**
         * Here we need to strip of the "id" field so that it doesn't end up in the "attributes" section of the json api document.
         * The id will automatically be added one node up from the "attributes" which is where we want it, example:
         * {
         *   "data": [
         *     {
         *       //The serializer will automatically add the id here...
         *       id: "01pG0000004GSM7IAO",
         *       type: "classes",
         *       attributes: {
         *         name: "AccountCreationBL",
         *         //We dont want the "id" to end up in this attribute object as well...
         *       }
         *     }
         *   ]
         * }
         */
        let jsonApiFieldNames = _.without(fieldNames, 'id');
        
        _debug.log(`jsonApiFieldNames => ${jsonApiFieldNames.join(', ')}`);
        
        //We will be adding this additional field to the response below.
        jsonApiFieldNames.push('isTestClass');
        
        ClassSerializer = new serializer('classes', {
            attributes: jsonApiFieldNames
        });
        
        return next();
    });
    
});

router.route('/').get(function(req, res, next) {
    
    return Q.all([
        jExt.getTestClasses(fieldNames),
        jExt.getAllClasses(fieldNames)
    ]).then(function(result) {
        
        let testClasses = result[0];
        let allClasses = result[1];
        
        //Create an array to hold all of the test class names.
        let testClassNames = _.map(testClasses, 'name');
        
        _.forEach(allClasses, function(record) {
            record['isTestClass'] = _.includes(testClassNames, record.name);
        });
        
        //Turn our response into a json api document.
        let jsonApiData = ClassSerializer.serialize(allClasses);
        
        return res.send(jsonApiData);
        
    }).catch(function(error) {
        let exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(routeErrorHandler);

module.exports = router;