'use strict';

let express = require('express');
let _ = require('lodash');
let request = require('request');
let serializer = require('jsonapi-serializer').Serializer;
let routeErrorHandler = require('../lib/route-error-handler');
let orgVersions = require('../lib/org-versions');

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