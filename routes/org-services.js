'use strict';

const express = require('express');
const _ = require('lodash');
const request = require('request');
const serializer = require('jsonapi-serializer').Serializer;
const routeErrorHandler = require('../lib/route-error-handler');
const orgVersions = require('../lib/org-versions');

let router = express.Router();

let ServicesDataSerializer = new serializer('org-api-versions', {
    attributes: ['label', 'url', 'version']
});

router.route('/org-api-versions').get(function(req, res, next) {
    
    return orgVersions(req.headers.instanceurl).then((result) => {
        
        let jsonApiDoc = ServicesDataSerializer.serialize(result);
        return res.send(jsonApiDoc);
        
    }).catch((error) => {
        return next(error);
    });
    
}).all(routeErrorHandler);

module.exports = router;