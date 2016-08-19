'use strict';

const redis = require('redis');
const Promise = require('bluebird');
const Debug = require('../debug');

//Promisify all of the redis calls (which currently use callbacks), this will help prevent deep code nesting.
//See: http://bluebirdjs.com/docs/api/promise.promisifyall.html
//NOTE: Basically this will append every redis function with the word "Async" so .get('key', callback) becomes .getAsync('key').then(...)
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

const _debug = new Debug('REDIS');
const client = redis.createClient(process.env.REDISCLOUD_URL);

client.on("ready", (msg) => _debug.log('redis ready', msg));
client.on("connect", (msg) => _debug.log('redis connected', msg));
client.on("reconnecting", (msg) => _debug.log('redis disconnected, reconnecting now', msg));
client.on("error", (msg) => _debug.log('error connecting to redis server', msg));
client.on("end", (msg) => _debug.log('redis connection closed', msg));
client.on("warning", (msg) => _debug.log('redis warning', msg));

module.exports.get = function(key, bypassCache) {

    if(bypassCache) {
        return Promise.resolve();
    }

    if(!key) {
        let exception = new Error('A key must be supplied when calling the "get" method from redis-manager.');
        return Promise.reject(exception);
    }

    return client.getAsync(key).then(result => {

        try {
            return JSON.parse(result);
        } catch(err) {
            return result;
        }

    }).then(result => {

        _debug.log(`Successfully retrieved cache key ${key}`);
        return result;

    });

};

/**
 * @param {number} ttl - The amount of time (in seconds) before this key expires. If omitted, the key will live forever.
 */
module.exports.set = function(key, val, ttl) {

    if(!key) {
        let exception = new Error('A key must be supplied when calling the "set" method from redis-manager.');
        return Promise.reject(exception);
    }

    if(!val) {
        let exception = new Error('A value must be supplied when calling the "set" method from redis-manager.');
        return Promise.reject(exception);
    }

    if(ttl && typeof ttl !== 'number') {
        let exception = new Error(`ttl supplied, expected number but received ${typeof ttl}`);
        return Promise.reject(exception);
    }

    try {
        val = JSON.stringify(val);
    } catch(err) {
        _debug.log(`Unable to stringify ${val}, inserting into redis as is.`);
    }

    let multi = client.multi().set(key, val);

    if(ttl) {
        multi.expire(key, ttl);
    }

    return multi.execAsync().then(result => {

        let setResult = result[0];
        let expireResult = result[1];

        _debug.log(`Successfully stored cache key ${key}`);

        if(expireResult) {
            _debug.log(`Result of setting an expiration of ${ttl} seconds on key ${key}`, expireResult);
        }

        return setResult;
    });
}