'use strict';

let express = require('express');
let _ = require('lodash');
let request = require('request');
let serializer = require('jsonapi-serializer').Serializer;
let routeErrorHandler = require('../lib/route-error-handler');

let router = express.Router();

let ServicesDataSerializer = new serializer('org-api-versions', {
    attributes: ['label', 'url', 'version']
});

router.route('/org-api-versions').get(function(req, res, next) {
    
    request.get(`${req.headers.instanceurl}/services/data`, function(rErr, rRes, rStringBody) {
        
        console.info('rErr', rErr);
        
        if(rErr) {
            let exception = new Error(rErr.message);
            exception.type = rErr.errorCode;
            exception.statusCode = 400;
            return next(exception);
        }
        
        let body = JSON.parse(rStringBody);
        console.info('body', body);
        
        _.forEach(body, function(value) {
            
            //Let's add an "id" property for json api spec compliance
            value.id = Number(value.version);
        });
        
        let jsonApiDoc = ServicesDataSerializer.serialize(body);
        return res.send(jsonApiDoc);
        
    });
    
}).all(routeErrorHandler);

module.exports = router;