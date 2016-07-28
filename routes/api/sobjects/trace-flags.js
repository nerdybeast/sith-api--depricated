'use strict';

const express = require('express');
const jas = require('jsonapi-serializer');
const _ = require('lodash');
const customSerializer = require('../../../lib/json-api-serializer');

let router = express.Router();

router.route('/').get(function(req, res, next) {
    
    let jExt = req.app.get('jExt');

    if(req.query.user) {

        jExt.getTraceFlagsByUserId(req.query.user).then(traceFlagQueryResult => {
            
            if(req.headers.acceptsJsonApi) {
                let serializedResult = customSerializer.traceFlag(traceFlagQueryResult.fieldNames, traceFlagQueryResult.records);
                return res.send(serializedResult);
            } else {
                return res.send(traceFlagQueryResult.records);
            }

        }).catch(err => {
            return next(err);
        });

    }

}).post(function(req, res, next) {

    let jExt = req.app.get('jExt');

    if(req.headers.isJsonApi) {

        customSerializer.deserializeAsync(req.body).then(traceFlag => {
            
            return jExt.conn.tooling.sobject('TraceFlag').create(traceFlag);

        }).then(createResult => {

            let traceFlagDoc = customSerializer.traceFlag(['id'], { id: createResult.id });
            return res.status(201).send(traceFlagDoc);

        }).catch(error => {
            return next(error);
        });

    } else {
        //TODO: Implement standard json response.
        return res.send({data:{}});
    }

});

router.route('/:traceFlagId').patch(function(req, res, next) {

    if(req.headers.isJsonApi) {

        customSerializer.deserializeAsync(req.body).then(traceFlag => {
            
            let validFieldsForUpdate = _.pick(traceFlag, ['debugLevelId', 'startDate', 'expirationDate']);
            
            //Salesforce chokes for some reason if the given "id" property is not capitalized which is odd because it doesn't hold this restriction on other api calls. 
            validFieldsForUpdate.Id = traceFlag.id;

            return req.app.get('jExt').conn.tooling.sobject('TraceFlag').update(validFieldsForUpdate);

        }).then(updateResult => {

            let traceFlagDoc = customSerializer.traceFlag(['id'], { id: updateResult.id });
            return res.send(traceFlagDoc);

        }).catch(error => {
            let exception = new Error(error.message || 'Unknown error occurred during trace flag update.');
            exception.title = 'Failed to update trace flag';
            return next(exception);
        });

    }

}).delete(function(req, res, next) {
    
    req.app.get('jExt').conn.tooling.sobject('TraceFlag').del(req.params.traceFlagId).then(result => {

        return res.send({
            meta: result
        });

    }).catch(error => {
        return next(error);
    });

});

module.exports = router;