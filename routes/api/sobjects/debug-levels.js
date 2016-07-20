'use strict';

const express = require('express');

let router = express.Router();

router.route('/').get(function(req, res, next) {
    
    let jExt = req.app.get('jExt');

    jExt.getAllDebugLevels(req.query.force).then(result => {
        return res.send(result);
    }).catch(error => {
        return next(error);
    });

});

module.exports = router;