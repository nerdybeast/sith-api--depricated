'use strict';

const express = require('express');

let router = express.Router();

router.use('/trace-flags', require('./trace-flags'));
router.use('/debug-levels', require('./debug-levels'));

module.exports = router;