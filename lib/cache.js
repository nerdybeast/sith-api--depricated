'use strict';

let NodeCache = require('node-cache');

let cache = new NodeCache({
    
    //Default the cache timeout for all keys to 20 minutes.
    stdTTL: 1200
    
}); 

module.exports = cache;