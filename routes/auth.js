var jsforce = require('jsforce');
var express = require('express');
var Q = require('q');
var _ = require('lodash');

var router = express.Router();

var jsforceConn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL
});

//Middleware that every request to this /ouath2 resource will pass through.
//NOTE: This must exist in this file before any routes are defined.
router.use(function(req, res, next) {
    
    console.log(jsforceConn.loginUrl);
    
    //We are only concerned (for now) with verifying that a username/password combo exists when a POST request is made.
    if(req.method.toLowerCase() !== 'post') {
        return next();
    }
    
    var username = req.body.username;
    var password = req.body.password;
    
    if(!username || !password) {
        var err = new Error('Request body is missing the "username" and/or "password" key.');
        err.status = 400;
        return next(err);
    }
    
    //The "next()" calls above are prefixed with the "return" keyword to completely fall out of this
    //function, without that key word this line will fire and won't catch our errors above.
    //NOTE: This doesn't need the "return" keyword (even though it could be used) because it is the final call to next().
    next();
});

//With Express.js router, the file name becomes part of the url path so reaching this point is actually "api/auth/".
router.route('/').post(function(req, res, next) {
    
    //req.body is available because we are using body-parser in app.js
    //Note: we are using a middleware function above that validates the username/password here.
    var username = req.body.username;
    var password = req.body.password;
    
    jsforceConn.login(username, password).then(function(userInfo) {
        
        console.log('userInfo =>', userInfo);
        
        var connectionDetails = {
            instanceUrl: jsforceConn.instanceUrl,
            accessToken: jsforceConn.accessToken
        };
        
        return Q.all([ jsforceConn.identity(), connectionDetails ]);
        
    }, function(error) {
        
        //Login failed, this will force the promise chain to fall into the catch block.
        return Q.reject({ 
            status: 401, 
            message: error.message,
            stack: error.stack 
        });
        
    }).then(function(result) {
        
        //The response returned to the client.
        return res.send({
            
            //Strip out the properties we care about to return to the user.
            user: _.pick(result[0], ['user_id', 'nick_name', 'display_name', 'email']),
            
            //Return the connection details so that subsequent requests can occur.
            conn: result[1]
        });
        
    }).catch(function(error) {
        next(error);
    });
    
}).all(function(req, res, next) {
    next(new Error(`${req.method} not supported at ${req.originalUrl}`));
});

module.exports = router;