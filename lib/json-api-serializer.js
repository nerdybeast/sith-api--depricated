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

module.exports = { serializeForUpdate };