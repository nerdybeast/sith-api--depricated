'use strict';

const express = require('express');
const serializer = require('../../../lib/json-api-serializer');

let router = express.Router();

router.route('/').get(function(req, res, next) {
    
    let sf = req.app.get('sf');

    //NOTE: req.query.force has already been validated and established as a legit boolean value.
    sf.getAllDebugLevels(req.query.force).then(debugLevelQueryResult => {
        
        if(req.headers.acceptsJsonApi) {
            let serializedResult = serializer.debugLevel(debugLevelQueryResult.fieldNames, debugLevelQueryResult.records);
            return res.send(serializedResult);
        } else {
            return res.send(debugLevelQueryResult.records);
        }

    }).catch(error => {
        return next(error);
    });

});

module.exports = router;