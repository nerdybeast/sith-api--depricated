'use strict';

const Promise = require('bluebird');
const _ = require('lodash');
const request = require('request');
const cache = require('./redis-manager');
const Debug = require('./debug');

let _debug = new Debug('ORG-VERSIONS');

module.exports = function(instanceUrl) {

    const cacheKey = `ORG_VERSIONS:${instanceUrl}`;

    return cache.get(cacheKey).then(cachedOrgVersions => {

        if(cachedOrgVersions) {
            return Promise.props({ 
                wasCached: true,
                orgVersions: cachedOrgVersions 
            });
        }

        return Promise.props({ 
            wasCached: false,
            orgVersions: getOrgVersions(instanceUrl) 
        });

    }).then(hash => {

        if(!hash.wasCached) {
            
            _.forEach(hash.orgVersions, function(value) {
                //Let's add an "id" property for json api spec compliance
                value.id = Number(value.version);
            });

            return Promise.props({
                orgVersions: hash.orgVersions,
                cacheResult: cache.set(cacheKey, hash.orgVersions, (60 * 60 * 24))
            });
        }

        return Promise.props({
            orgVersions: hash.orgVersions
        });

    }).then(hash => {

        if(hash.cacheResult) {
            _debug.log(`Result of caching the key ${cacheKey}`, hash.cacheResult);
        }

        return hash.orgVersions;

    });
}

function getOrgVersions(instanceUrl) {
    
    return new Promise((resolve, reject) => {

        let url = `${instanceUrl}/services/data`;
        let json = true;

        request.get({ url, json }, function(err, result, orgVersions) {
            
            if(err) {
                let exception = new Error(err.message);
                exception.type = err.errorCode;
                exception.statusCode = 400;
                return reject(exception);
            }
            
            _.forEach(orgVersions, function(value) {
                //Let's add an "id" property for json api spec compliance
                value.id = Number(value.version);
            });
            
            return resolve(orgVersions);
        });

    });
}