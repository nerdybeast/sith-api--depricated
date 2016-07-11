'use strict';

const express = require('express');
const routeErrorHandler = require('../../lib/route-error-handler');
const JsforceExt = require('../../lib/jsforceExt');
    
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

router.route('/:orgId').get((req, res, next) => {
    
    return jExt.getOrgLimits().then(result => {

        return res.send(result);
        
    }).catch(function(error) {
        var exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(routeErrorHandler);

module.exports = router;