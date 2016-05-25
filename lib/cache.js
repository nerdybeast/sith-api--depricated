'use strict';

//let bluebird = require('bluebird');
let NodeCache = require('node-cache');

let cache = new NodeCache({
    
    //Default the cache timeout for all keys to 20 minutes.
    stdTTL: 1200
    
}); 

// let async = {
//     set: bluebird.promisifyAll(cache.set)
// };

module.exports = cache;