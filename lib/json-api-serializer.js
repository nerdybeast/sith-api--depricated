'use strict';

let _ = require('lodash');
let Serializer = require('jsonapi-serializer').Serializer;

function serialize(type, fieldNames, records) {
    
    let attributes = _.without(fieldNames, 'id');
    
    let s = new Serializer(type, { attributes });
    return s.serialize(records);
}

module.exports = { serialize };