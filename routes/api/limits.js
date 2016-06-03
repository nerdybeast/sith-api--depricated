'use strict';

let express = require('express');
let routeErrorHandler = require('../../lib/route-error-handler');
let JsforceExt = require('../../lib/jsforceExt');

module.exports = function(io) {
    
    let router = express.Router();
    
    let jExt;

    router.use((req, res, next) => {
        
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
    
    return router;
}