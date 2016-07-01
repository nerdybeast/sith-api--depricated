'use strict';

let express = require('express');
let Promise = require('bluebird');
let routeErrorHandler = require('../../lib/route-error-handler');
let cache = require('../../lib/cache');
let Debug = require('../../lib/debug');
let JsforceExt = require('../../lib/jsforceExt');
    
let _debug = new Debug('routes/api/setup');
let router = express.Router();

let jExt;
let io;

router.use((req, res, next) => {
    io = req.app.get('io');

    jExt = new JsforceExt({
        accessToken: req.headers.sessionid,
        instanceUrl: req.headers.instanceurl
    }, io);
    
    next();
});

router.route('/').post((req, res, next) => {
    
    let profile = req.body.profile;

    if(!profile) {
        let exception = new Error('POST to /setup expects a "profile" object in the body.');
        return next(exception);
    }

    let cacheKey = `USER:${profile.username}`;
    let cachedUser = cache.get(cacheKey);

    if(!cachedUser) {
        cache.set(cacheKey, profile, (err, success) => {   
            if(err) { _debug.log('Error setting profile in the cache', err); }
        });
    }

    Promise.props({
        orgLimits: jExt.getOrgLimits()
    }).then(hash => {
        return res.send(hash);
    }).catch(error => {
        var exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(routeErrorHandler);

module.exports = router;