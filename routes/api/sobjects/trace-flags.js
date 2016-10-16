'use strict';

const express = require('express');
const jas = require('jsonapi-serializer');
const _ = require('lodash');
const customSerializer = require('../../../lib/json-api-serializer');

let router = express.Router();
let sf;

router.use(function(req, res, next) {
    sf = req.app.get('sf');
    next();
})

router.route('/').get(function(req, res, next) {

    //TODO: need to handle if a query param of "user" is not supplied...

    if(req.query.user) {

        sf.getTraceFlagsByUserId(req.query.user).then(traceFlagQueryResult => {
            
            if(req.headers.acceptsJsonApi) {
                let serializedResult = customSerializer.traceFlag(traceFlagQueryResult.fieldNames, traceFlagQueryResult.records);
                return res.send(serializedResult);
            } else {
                return res.send(traceFlagQueryResult.records);
            }

        }).catch(error => {
            error.statusCode = 400;
            error.title = 'TraceFlag Search Error';
            error.stackTrace = error.stack;
            return next(error);
        });

    }

}).post(function(req, res, next) {

    if(req.headers.isJsonApi) {

        customSerializer.deserializeAsync(req.body).then(traceFlag => {
            
            return sf.conn.tooling.sobject('TraceFlag').create(traceFlag);

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

            return sf.conn.tooling.sobject('TraceFlag').update(validFieldsForUpdate);

        }).then(updateResult => {

            let traceFlagDoc = customSerializer.traceFlag(['id'], { id: updateResult.id });
            return res.send(traceFlagDoc);

        }).catch(error => {

            let detail;
            switch(error.errorCode) {
                case 'INVALID_ID_FIELD':
                    detail = 'This trace flag no longer exists in the current org.';
                    break;
                default:
                    detail = error.message || 'Unknown error occurred during trace flag update.';
                    break;
            }

            let exception = new Error(detail);
            exception.title = 'Failed to update trace flag';
            exception.errorCode = error.errorCode;
            exception.stackTrace = error.stack;
            return next(exception);
        });

    }

}).delete(function(req, res, next) {
    
    sf.conn.tooling.sobject('TraceFlag').del(req.params.traceFlagId).then(result => {

        return res.send({
            meta: result
        });

    }).catch(error => {
        
        //This error code seems to mean that the trace flag for which we are trying to delete has already been deleted on the server.
        if(error.errorCode === 'INVALID_CROSS_REFERENCE_KEY') {
            return res.send({
                meta: {
                    id: req.params.traceFlagId,
                    success: true
                }
            });
        }

        return next(error);
    });

});

module.exports = router;