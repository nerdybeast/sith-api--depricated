'use strict';

const express = require('express');
const Promise = require('bluebird');
const _ = require('lodash');
const routeErrorHandler = require('../../lib/route-error-handler');
const Debug = require('../../lib/debug');
const db = require('../../lib/db');
    
let _debug = new Debug('MANAGE-USERS');
let router = express.Router();

router.use((req, res, next) => {
    next();
});

router.route('/').post((req, res, next) => {
    
    //Will be the new user's profile object after having just authenticated with Salesforce, ex:
    //{ active: true, organization_id: '00D17000000BLCaEAO', id: 'https://test.salesforce.com/id/00D16000000ALCaEAO/005F0000003pgl8IAA', etc... }
    let profile = req.body;

    db.insertProfile(profile).then(result => {
        return res.send();
    }).catch(error => {
        let exception = new Error(error);
        return next(exception);
    });

}).all(routeErrorHandler);

module.exports = router;