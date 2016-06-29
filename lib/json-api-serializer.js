'use strict';

let _ = require('lodash');
let Serializer = require('jsonapi-serializer').Serializer;

function _base(type, fieldNames, records) {
    let attributes = _.without(fieldNames, 'id');
    let serializer = new Serializer(type, { attributes });
    return serializer.serialize(records);
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
    return _base('apex-test-queue-item', fieldNames, records);
}

module.exports.apexTestResult = function(fieldNames, records) {
    return _base('apex-test-result', fieldNames, records);
}

module.exports.asyncApexJob = function(fieldNames, records) {
    return _base('async-apex-job', fieldNames, records);
}

module.exports.apexLog = function(fieldNames, records) {
    return _base('apex-log', fieldNames, records);
}