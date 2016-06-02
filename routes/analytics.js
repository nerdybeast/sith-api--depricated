'use strict';

let express = require('express');
let _ = require('lodash');
let elasticsearch = require('elasticsearch');
let routeErrorHandler = require('../lib/route-error-handler')

let router = express.Router();

let client = new elasticsearch.Client({
    host: process.env.SEARCHBOX_URL,
    log: 'trace',
    apiVersion: '2.1'
});

router.route('/ping').get((req, res, next) => {
  
    client.ping().then(function(result) {
        res.send(result);
    }, function(error) {
        next(error);
    });
    
}).all(routeErrorHandler);

router.route('/bulk').post(function(req, res, next) {
  
    let analytics = req.body || [];
    let data = [];
    
    _.forEach(analytics, function(value) {
        data.push({ create: { _index: 'analytics', _type: 'test' } });
        data.push(value);
    });
    
    client.bulk({ body: data }).then(function(result) {
        res.send(result);
    }, function(error) {
        next(error);
    });
    
}).all(routeErrorHandler);

module.exports = router;