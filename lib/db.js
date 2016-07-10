'use strict';

const _ = require('lodash');
const elasticsearch = require('elasticsearch');
const Promise = require('bluebird');
const Debug = require('./debug');
const cache = require('./redis-manager');

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

        return cache.get(identifier).then(cachedProfile => {

            if(cachedProfile) {
                return cachedProfile;
            }

            return this.client.get({
                index: 'salesforce',
                type: 'users',
                id: identifier
            });

        }).then(dbSearchResult => {

            _debug.log(`db search for ${identifier} result`, dbSearchResult);
            return dbSearchResult._source;

        }).catch(error => {
            
            _debug.log(`An exception occured getting profile for ${identifier}`, dbSearchResult);
            return Promise.reject(error);
        });
    }

    insertProfile(profile) {

        let identifier = `${profile.user_id}-${profile.organization_id}`;

        let dbParams = { 
            index: 'salesforce', 
            type: 'users', 
            id: identifier
        };

        return cache.get(identifier).then(cachedProfile => {

            if(cachedProfile && _.isEqual(cachedProfile, profile)) {
                _debug.log(`New profile for ${profile.username} matches cache, skipping insert into db.`);
                return profile;
            }

            return this.client.exists(dbParams);

        }).then(profileAlreadyExists => {

            if(profileAlreadyExists) {

                _debug.log(`Profile for ${profile.username} already exists, running update to db.`);

                //Update requires the "doc" property nested within the body, see:
                //https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference-2-1.html#api-update-2-1
                dbParams.body = { doc: profile };

                return this.client.update(dbParams);

            } else {
                
                dbParams.body = profile;
                return this.client.create(dbParams);
            }

        }).then(result => {
                
            _debug.log('elasticsearch result', result);
            return cache.set(identifier, profile);

        }).then(cacheSetResult => {

            _debug.log('cache set result', cacheSetResult);
            return profile;

        }).catch(error => {
            
            _debug.log(`profile insert error`, error);
            return Promise.reject(error);
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