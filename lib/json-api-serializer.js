'use strict';

const _ = require('lodash');
const jas = require('jsonapi-serializer');
const Promise = require('bluebird');

const Serializer = jas.Serializer;
const Deserializer = jas.Deserializer;

function _baseSerializer(type, fieldNames, records) {
    let attributes = _.without(fieldNames, 'id');
    let serializer = new Serializer(type, { attributes });
    return serializer.serialize(records);
}

function _baseDeserializer(data) {
    return new Promise((resolve, reject) => {
        let deserializer = new Deserializer({ keyForAttribute: 'camelCase' });
        deserializer.deserialize(data, (error, value) => {
            if(error) return reject(error);
            return resolve(value);
        });
    });
}

module.exports.serializeForUpdate = function(type, fieldNames, records) {
    
    let attributes = _.without(fieldNames, 'id');
    
    let s = new Serializer(type, { 
        attributes, 
        pluralizeType: false,
        keyForAttribute: 'camelCase' 
    });
    
    return s.serialize(records);
}

module.exports.apexTestQueueItem = function(fieldNames, records) {
    return _baseSerializer('apex-test-queue-item', fieldNames, records);
}

module.exports.apexTestResult = function(fieldNames, records) {
    return _baseSerializer('apex-test-result', fieldNames, records);
}

module.exports.asyncApexJob = function(fieldNames, records) {
    return _baseSerializer('async-apex-job', fieldNames, records);
}

module.exports.apexLog = function(fieldNames, records) {
    return _baseSerializer('apex-log', fieldNames, records);
}

module.exports.traceFlag = function(fieldNames, records) {
    return _baseSerializer('trace-flag', fieldNames, records);
}

module.exports.debugLevel = function(fieldNames, records) {
    return _baseSerializer('debug-level', fieldNames, records);
}

module.exports.apexTestRunResult = function(fieldNames, records) {
    return _baseSerializer('apex-test-run-result', fieldNames, records);
}

module.exports.deserializeAsync = function(data) {
    return _baseDeserializer(data);
}