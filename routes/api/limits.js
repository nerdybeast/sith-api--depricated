'use strict';

let express = require('express');
let routeErrorHandler = require('../../lib/route-error-handler');
let JsforceExt = require('../../lib/jsforceExt');
    
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

router.route('/').get((req, res, next) => {
    
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