'use strict';

let Q = require('q');
let express = require('express');
let _ = require('lodash');
let JsforceExt = require('../../lib/jsforceExt');
let serializer = require('jsonapi-serializer').Serializer;
let routeErrorHandler = require('../../lib/route-error-handler');

let Debug = require('../../lib/debug');
let d = new Debug('CLASSES');

let router = express.Router();

//Will hold an instance of our extended jsforce module.
let jExt;

//Will hold the field names from our describe() call into salesforce, these names will be "CamelCased".
let fieldNames;
 
//Will hold our json api serializer for the "ApexClass" class in Salesforce.
let ClassSerializer;

//This middleware function will be invoked for every request made to a route defined in this file.
router.use(function(req, res, next) {
    
    jExt = new JsforceExt({
        accessToken: req.headers.sessionid,
        instanceUrl: req.headers.instanceurl
    }, null);
    
    jExt.getSobjectFieldNames('ApexClass').then(function(fieldNamesResult) {
        
        //Let's remove the body fields because they will contain the entire contents of the class which will make our response huge.
        fieldNames = _.without(fieldNamesResult, 'body', 'bodyCrc');
        
        d.log(`ApexClass field names => ${fieldNames.join(', ')}`);
        
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
        
        d.log(`jsonApiFieldNames => ${jsonApiFieldNames.join(', ')}`);
        
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

//router.all('*', routeErrorHandler);

// router.route('/istest').get(function(req, res, next) {
    
//     jExt.getTestClasses(fieldNames).then(function(result) {
        
//         console.log(result[0]);
        
//         //Stripping off the "attributes" property for now.
//         var strippedResult = _.map(result, function(record) {
//             return _.pick(record, fieldNames);
//         });
        
//         console.log('@isTest count:', strippedResult.length);
        
//         return res.send(strippedResult);
        
//     }).catch(function(error) {
//         var exception = new Error(error.message);
//         exception.type = error.errorCode;
//         exception.statusCode = 400;
//         return next(exception);
//     });
    
// }).all(routeErrorHandler);

module.exports = router;