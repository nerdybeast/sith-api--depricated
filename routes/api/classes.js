'use strict';

const Promise = require('bluebird');
const express = require('express');
const _ = require('lodash');
const serializer = require('../../lib/json-api-serializer');
const routeErrorHandler = require('../../lib/route-error-handler');
const Debug = require('../../lib/debug');

let _debug = new Debug('CLASSES');
let router = express.Router();

router.route('/').get(function(req, res, next) {

    let sf = req.app.get('sf');

    let promiseHash = {
        allClasses: sf.getAllClasses(),
        testClasses: sf.getTestClasses()
    };

    Promise.props(promiseHash).then(result => {

        //Create an array to hold all of the test class names.
        let testClassNames = _.map(result.testClasses.records, 'name');
        
        _.forEach(result.allClasses.records, function(record) {
            record['isTestClass'] = _.includes(testClassNames, record.name);
        });
        
        //Push this field name so the json api serializer will add it to the response.
        result.allClasses.fieldNames.push('isTestClass');

        //Turn our response into a json api document.
        let jsonApiData = serializer.apexClass(result.allClasses.fieldNames, result.allClasses.records);
        
        return res.send(jsonApiData);

    }).catch(error => {
        let exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
});

module.exports = router;