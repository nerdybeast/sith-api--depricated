'use strict';

let request = require('request');
let Promise = require('bluebird');
let _ = require('lodash');
let cache = require('./cache');

module.exports = function(instanceUrl) {
    
    const cacheKey = `ORG_VERSIONS:${instanceUrl}`;
    let cachedOrgVersions = cache.get(cacheKey);
    
    return new Promise((resolve, reject) => {
       
       if(cachedOrgVersions) {
           return resolve(cachedOrgVersions);
       }
       
       let url = `${instanceUrl}/services/data`;
       let json = true;
       
       request.get({ url, json }, function(err, result, response) {
            
            if(err) {
                let exception = new Error(err.message);
                exception.type = err.errorCode;
                exception.statusCode = 400;
                return reject(exception);
            }
            
            _.forEach(response, function(value) {
                //Let's add an "id" property for json api spec compliance
                value.id = Number(value.version);
            });
            
            //Set cache for 1 day.
            cache.set(cacheKey, response, (60 * 60 * 24));
            
            return resolve(response);
        });
    });
}