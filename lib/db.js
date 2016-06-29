'use strict';

let _ = require('lodash');
let elasticsearch = require('elasticsearch');
let Promise = require('bluebird');

class Db {
    constructor() {
        this.client = new elasticsearch.Client({
            host: process.env.SEARCHBOX_URL,
            log: 'trace',
            apiVersion: '2.1'
        });
    }

    ping() {
        return this.client.ping();
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