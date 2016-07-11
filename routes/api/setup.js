'use strict';

let express = require('express');
let Promise = require('bluebird');
let routeErrorHandler = require('../../lib/route-error-handler');
let Debug = require('../../lib/debug');
let JsforceExt = require('../../lib/jsforceExt');
    
let _debug = new Debug('routes/api/setup');
let router = express.Router();

let jExt;

router.use((req, res, next) => {
    
    let io = req.app.get('io');

    let connectionDetails = {
        accessToken: req.headers.sessionid,
        instanceUrl: req.headers.instanceurl
    };

    let profile = {
        userId: req.headers.userid,
        orgId: req.headers.orgid
    }; 

    jExt = new JsforceExt(connectionDetails, profile, io);
    
    next();
});

router.route('/').get((req, res, next) => {
    
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