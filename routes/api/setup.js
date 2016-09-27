'use strict';

const express = require('express');
const Promise = require('bluebird');
const routeErrorHandler = require('../../lib/route-error-handler');
const Debug = require('../../lib/debug');
    
let _debug = new Debug('routes/api/setup');
let router = express.Router();

router.route('/').get((req, res, next) => {
    
    let sf = req.app.get('sf');

    Promise.props({
        orgLimits: sf.getOrgLimits()
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