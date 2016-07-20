'use strict';

const express = require('express');

let router = express.Router();

router.route('/:userId').get(function(req, res, next) {
    
    let jExt = req.app.get('jExt');

    jExt.getTraceFlagsByUserId(req.headers.userid).then(traceFlagQueryResult => {
        return res.send(traceFlagQueryResult);
    }).catch(err => {
        return next(err);
    });
});

module.exports = router;