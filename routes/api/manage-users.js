'use strict';

const express = require('express');
const Promise = require('bluebird');
const _ = require('lodash');
const routeErrorHandler = require('../../lib/route-error-handler');
const cache = require('../../lib/cache');
const Debug = require('../../lib/debug');
    
let _debug = new Debug('routes/api/setup');
let router = express.Router();

router.use((req, res, next) => {
    next();
});

router.route('/').post((req, res, next) => {
    
    //Will be the new user's profile object after having just authenticated with Salesforce, ex:
    //{ active: true, organization_id: '00D17000000BLCaEAO', id: 'https://test.salesforce.com/id/00D16000000ALCaEAO/005F0000003pgl8IAA', etc... }
    let newProfile = req.body;

    let cacheKey = `USERS:${req.headers.username}`;
    let cachedProfile = cache.get(cacheKey);
    
    if(!_.isEqual(cachedProfile, newProfile)) {
        
        //Cache the new profile for an hour.
        cache.set(cacheKey, newProfile, (60 * 60), (err, success) => {
            if(err) { _debug.log('Error setting profile in the cache', err); }
        });
    }

    return res.send();
    
}).all(routeErrorHandler);

module.exports = router;