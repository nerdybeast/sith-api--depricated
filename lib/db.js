'use strict';

const _ = require('lodash');
const elasticsearch = require('elasticsearch');
const Promise = require('bluebird');
const Debug = require('./debug');
const cache = require('./cache');

let _debug = new Debug('DB');

class Db {
    constructor() {
        this.client = new elasticsearch.Client({
            host: process.env.SEARCHBOX_URL,
            log: 'error',
            apiVersion: '2.1'
        });
    }

    ping() {
        return this.client.ping();
    }

    getProfile(userId, orgId) {

        let identifier = `${userId}-${orgId}`;

        return new Promise((resolve, reject) => {

            let cachedProfile = cache.get(`USERS:${identifier}`);

            if(cachedProfile) {
                return resolve(cachedProfile);
            }

            let params = { index: 'salesforce', type: 'users', id: identifier };
            this.client.get(params).then(result => {
                return resolve(result._source);
            }).catch(error => {
                return reject(error);
            });

        });
    }

    createProfile(profile) {

        let identifier = `${profile.user_id}-${profile.organization_id}`;
        let cacheKey = `USERS:${identifier}`;

        return new Promise((resolve, reject) => {

            let cachedProfile = cache.get(cacheKey);

            if(_.isEqual(cachedProfile, profile)) {
                _debug.log('Profile matches cache, returning immediately');
                return resolve();
            }

            let params = { 
                index: 'salesforce', 
                type: 'users', 
                id: identifier
            };
            
            this.client.exists(params).then(alreadyExists => {

                _debug.log(`Profile for ${profile.username} already exists => ${alreadyExists}`);

                if(alreadyExists) {

                    //Update requires the "doc" property nested within the body, see:
                    //https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference-2-1.html#api-update-2-1
                    params.body = { doc: profile };
                    return this.client.update(params);

                } else {
                    
                    params.body = profile;
                    return this.client.create(params);
                }

            }).then(result => {
                
                _debug.log('elasticsearch result', result);
    
                //Cache the new profile for 12 hours.
                cache.set(cacheKey, profile, (60 * 60 * 12), (err, success) => {
                    if(err) { _debug.log('Error setting profile in the cache', err); }
                    return resolve();
                });

            }).catch(error => {
                return reject(error);
            });

        });
    }

    bulkAnalyticUpload(analytics) {
        
        analytics = analytics || [];
        let body = [];
        
        _.forEach(analytics, (value) => {
            body.push({ create: { _index: 'analytics', _type: 'test' } });
            body.push(value);
        });
        
        if(body.length > 0) {
            return this.client.bulk({ body });
        }
        
        return Promise.resolve();
    }
}

//Exporting a "new" instance of this class will mean that only 1 instance of this class will live for the entire application.
//This may not be a good idea, will change if necessary.
module.exports = new Db();