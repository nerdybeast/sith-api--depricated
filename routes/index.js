'use strict';

const jwt = require('express-jwt');
const debug = require('debug')('api index');
const rollbar = require('rollbar');
const JsforceExt = require('../lib/jsforceExt');

rollbar.init(process.env.ROLLBAR_ACCESS_TOKEN);

let RoutesCore = function(app) {
    
    let io = app.get('io');

    app.get('/', function(req, res) {
        
        io.emit('debug-from-server', {
            message: '/ root of api accessed'
        });
        
        res.send({
            port: app.get('port'),
            env: process.env.NODE_ENV,
            sfLoginUrl: process.env.SF_LOGIN_URL
        });
    });
    
    app.use(function(req, res, next) {
        
        const jsonMimeType = 'application/json';
        const jsonApiMimeType = 'application/vnd.api+json';
        
        //These variables will return a string if the "Accept" header contains one of the above supported media types
        //otherwise, they will return false.
        let acceptsJson = req.accepts(jsonMimeType);
        let acceptsJsonApi = req.accepts(jsonApiMimeType);
        
        //These variables will also return a string if the given value matches the Content-Type of the request, here we are forcing into a boolean value.
        let isPlainJson = (req.is(jsonMimeType) !== false);
        let isJsonApi = (req.is(jsonApiMimeType) !== false);

        if(!acceptsJson && !acceptsJsonApi) {
            let err = new Error(`All requests to this api must specify an "Accept" header with a value of either "${jsonApiMimeType}" or "${jsonMimeType}".`);
            err.type = 'UNSUPPORTED_MEDIA_TYPE';
            err.statusCode = 415;
            return next(err);
        }

        //NOTE: Content-Type is not usually passed with some http verbs such as a GET request.
        if(req.get('Content-Type') && !isPlainJson && !isJsonApi) {
            let err = new Error(`All requests to this api containing a body (valid json), must specify a "Content-Type" header with a value of either "${jsonApiMimeType}" or "${jsonMimeType}".`);
            err.type = 'UNSUPPORTED_MEDIA_TYPE';
            err.statusCode = 415;
            return next(err);
        }
        
        //Let's see if the incoming request is asking for a json api doc to be returned. Tacking on an additional
        //header so that we can determine what type of content to return.
        //See: http://expressjs.com/en/api.html#req.accepts
        req.headers.acceptsJsonApi = (acceptsJsonApi && acceptsJsonApi !== false);
        
        req.headers.isJsonApi = isJsonApi;

        return next();
    });
    
    app.use('/analytics', require('./analytics'));
    app.use('/services', require('./org-services'));
    
    //Authenticate all requests to /api*
    app.use('/api', jwt({
        secret: new Buffer(process.env.AUTH0_CLIENT_SECRET, 'base64'),
        audience: process.env.AUTH0_CLIENT_ID
    }), (req, res, next) => {
        next();
    });
    
    app.use('/api', function(req, res, next) {
        
        let connectionDetails = {
            accessToken: req.headers.sessionid,
            instanceUrl: req.headers.instanceurl
        };

        let profile = {
            userId: req.headers.userid,
            orgId: req.headers.orgid
        }; 

        app.set('jExt', new JsforceExt(connectionDetails, profile, io));

        //Turn this query param into a solid boolean
        req.query.force = (req.query.force !== undefined);

        next();
    });

    //TODO: Need to account for the "Content-Type" passed, we only want to serve up a json api doc if "application/vnd.api+json"
    //is given. If not that, then serve up traditional json.
    
    app.use('/api/user', require('./api/manage-users'));
    app.use('/api/classes', require('./api/classes'));
    app.use('/api/run-tests', require('./api/execute-test-run'));
    app.use('/api/limits', require('./api/limits'));
    app.use('/api/dashboard', require('./api/setup'));
    app.use('/api/sobjects', require('./api/sobjects'));
    
    //TODO: app.use('/api', ...some module that converts the response between json & jsonApi);
    
    //Catch a 404 (request that didn't match a route defined above) and pass it down below to an error handler.
    //NOTE: Errors thrown in above routes will not be caught here because this function does not accept an error parameter.
    app.use(function(req, res, next) {
        let err = new Error('Not Found');
        err.type = 'RESOURCE_NOT_FOUND';
        err.statusCode = 404;
        next(err);
    });

    if(process.env.NODE_ENV !== 'localhost') {
        app.use(rollbar.errorHandler());
    }

    //This function will only catch errors if it has 4 parameters, see:
    //http://expressjs.com/en/guide/error-handling.html
    app.use(function(err, req, res, next) {

        let exception = {
            status: err.statusCode || 500,
            code: err.errorCode || 'UNKNOWN_ERROR',
            title: err.title || 'An unknown error has occured',
            detail: err.message || 'An unknown error has occured',
            meta: {
                stackTrace: err.stackTrace
            }
        };

        //Will be true if the client is expecting a JSON API spec response.
        if(req.headers.acceptsJsonApi) {
            exception = { errors: [exception] };
        }

        return res.status(exception.status).send(exception);
    });
}

module.exports = RoutesCore;