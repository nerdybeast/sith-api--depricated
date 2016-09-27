'use strict';

const express = require('express');
const routeErrorHandler = require('../../lib/route-error-handler');
    
let router = express.Router();

router.route('/:orgId').get((req, res, next) => {
    
    let sf = req.app.get('sf');

    return sf.getOrgLimits().then(result => {

        return res.send(result);
        
    }).catch(function(error) {
        var exception = new Error(error.message);
        exception.type = error.errorCode;
        exception.statusCode = 400;
        return next(exception);
    });
    
}).all(routeErrorHandler);

module.exports = router;