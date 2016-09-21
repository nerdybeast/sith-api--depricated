'use strict';

module.exports = function(req, res, next) {
        
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
}