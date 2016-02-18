var isProd = (process.env.NODE_ENV === 'production');

module.exports = function(app) {
    
    app.get('/', function(req, res) {
        res.send({
            port: app.get('port'),
            env: process.env.NODE_ENV,
            sfLoginUrl: process.env.SF_LOGIN_URL
        });
    });
    
    app.use('/auth', require('./auth'));
    
    var api = require('./api')();
    app.use('/api', api);
    
    //Catch a 404 (request that didn't match a route defined above) and pass it down below to an error handler.
    //NOTE: Errors thrown in above routes will not be caught here because this function does not accept an error parameter.
    app.use(function(req, res, next) {
        var err = new Error('Not Found');
        err.type = 'RESOURCE_NOT_FOUND';
        err.statusCode = 404;
        next(err);
    });

    //This function will only catch errors if it has 4 parameters, see:
    //http://expressjs.com/en/guide/error-handling.html
    app.use(function(err, req, res, next) {
        
        var status = err.statusCode || 500;
        
        return res.status(status).send({ 
            message: err.message, 
            //Prevent leaking stack trace info in Prod.
            //stackTrace: (isProd ? null : err.stack),
            stackTrace: err.stack,
            type: err.type,
            code: status
        });
    });
}