'use strict';

const express = require('express');
const customSerializer = require('../../../lib/json-api-serializer');
const _ = require('lodash');

let router = express.Router();

router.route('/').get(function(req, res, next) {

    let sf = req.app.get('sf');

    sf.globalDescribe().then(data => {
        let jsonApiDoc = customSerializer.baseSerializer('sobject', data.fieldNames, data.sobjects);
        return res.send(jsonApiDoc);
    });

});

router.route('/describe/:sobject').get(function(req, res, next) {

    let sf = req.app.get('sf');
    let sobjectName = req.params.sobject;

    sf.describeSobject(sobjectName).then(data => {

        let fieldDescriptionFieldNames = _.keys(data.result.fields[0]);

        //Give each field description a unique id that associates it with the given sobject.
        data.result.fields = data.result.fields.map(field => {
            field.id = `${sobjectName}:${field.name}`;
        });

        let fieldDescriptionDocs = customSerializer.baseSerializer('field-description', fieldDescriptionFieldNames, data.result.fields);

        data.result.fields = data.result.fields.map(field => {
            return { type: 'field-description', id: field.id };
        });

        

    });

});

router.use('/trace-flags', require('./trace-flags'));
router.use('/debug-levels', require('./debug-levels'));

module.exports = router;