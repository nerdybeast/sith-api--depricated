'use strict';

let _ = require('lodash');
let Serializer = require('jsonapi-serializer').Serializer;

function serializeForUpdate(type, fieldNames, records) {
    
    let attributes = _.without(fieldNames, 'id');
    
    let s = new Serializer(type, { 
        attributes, 
        pluralizeType: false,
        keyForAttribute: 'camelCase' 
    });
    
    return s.serialize(records);
}

function apexTestQueueItem(fieldNames, records) {
    return _base('apex-test-queue-item', fieldNames, records);
}

function apexTestResult(fieldNames, records) {
    return _base('apex-test-result', fieldNames, records);
}

function asyncApexJob(fieldNames, records) {
    return _base('async-apex-job', fieldNames, records);
}

function _base(type, fieldNames, records) {
    
    let attributes = _.without(fieldNames, 'id');
    let serializer = new Serializer(type, { attributes });
    return serializer.serialize(records);
}

module.exports = { 
    serializeForUpdate,
    apexTestQueueItem,
    apexTestResult,
    asyncApexJob
};