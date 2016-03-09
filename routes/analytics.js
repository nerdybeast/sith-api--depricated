'use strict';

var express = require('express');
var _ = require('lodash');
var elasticsearch = require('elasticsearch');

var router = express.Router();

var client = new elasticsearch.Client({
    host: process.env.SEARCHBOX_URL,
    log: 'trace',
    apiVersion: '2.1'
});

router.route('/ping').get(function(req, res, next) {
  
    client.ping().then(function(result) {
        res.send(result);
    }, function(error) {
        next(error);
    });
    
}).all(function(req, res, next) {
    next(new Error(`${req.method} not supported at ${req.originalUrl}`));
});

router.route('/bulk').post(function(req, res, next) {
  
    let analytics = req.body || [];
    let data = [];
    
    _.forEach(analytics, function(value) {
        data.push({ create: { _index: 'analytics', _type: 'test' } });
        data.push(value);
    });
    
    //res.send({ body: data });
    client.bulk({ body: data }).then(function(result) {
        res.send(result);
    }, function(error) {
        next(error);
    });
    
}).all(function(req, res, next) {
    next(new Error(`${req.method} not supported at ${req.originalUrl}`));
});

module.exports = router;