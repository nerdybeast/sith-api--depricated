'use strict';

const NodeCache = require('node-cache');
const Debug = require('./debug');

let _debug = new Debug('CACHE');

let cache = new NodeCache({
    
    //Default the cache timeout for all keys to 20 minutes.
    stdTTL: 1200
    
});

cache.on('set', (key) => _debug.log(`Key added/modified`, key));
cache.on('del', (key) => _debug.log(`Key deleted`, key));
cache.on('expired', (key) => _debug.log(`Key expired`, key));

module.exports = cache;