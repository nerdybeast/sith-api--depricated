'use strict';

let express = require('express');
let _ = require('lodash');
let elasticsearch = require('elasticsearch');
let routeErrorHandler = require('../lib/route-error-handler');
let db = require('../lib/db');

let router = express.Router();

router.route('/ping').get((req, res, next) => {

    let startTime = new Date().getTime();

    db.ping().then(function(result) {
        
        let available = result;
        let responseTime = new Date().getTime() - startTime;

        return res.send({ available, responseTime });

    }, function(error) {
        return next(error);
    });
    
}).all(routeErrorHandler);

router.route('/bulk').post(function(req, res, next) {
  
    let analytics = req.body || [];
    let orgId = req.headers.orgid || 'test';

    db.bulkAnalyticUpload(analytics, orgid).then(result => {
        return res.send(result);
    }).catch(error => {
        return next(error);
    });
    
}).all(routeErrorHandler);

module.exports = router;