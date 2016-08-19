'use strict';

const http = require('http');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const _ = require('lodash');

//middle-ware that allows easy manipulation of cookies incoming/outgoing
const cookieParser = require('cookie-parser');

//middle-ware that allows easy manipulation of request/response bodies
const bodyParser = require('body-parser');

//Creates a middleware that records the response time for requests.
//https://www.npmjs.com/package/response-time
const responseTime = require('response-time');

let app = express();

//Storing some custom settings on the Express object so that they can be accessed later if neccessary.
//NOTE: See http://expressjs.com/en/4x/api.html#app.settings.table for built-in Express settings. 
app.set('port', (process.env.PORT || 5000));

let server = app.listen(app.get('port'));
let io = require('socket.io')(server);

require('./lib/io-manager')(io);

//Set the io instance on the app so that we don't have to pass it as a function parameter to every module.
app.set('io', io);

app.use(morgan('dev'));
app.use(responseTime({ digits:0 }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));

//Tell the json body parser to parse all request bodies that contain a Content-Type matching this expression. 
app.use(bodyParser.json({ type: ['application/json', 'application/vnd.api+json'] }));

//Currently this is used to enable all cross origin requests.
//TODO: Restrict access when in production, possibly staging as well...
app.use(cors());

//Automatically loads routes/index.js, see:
//https://nodejs.org/api/modules.html#modules_folders_as_modules
require('./routes')(app);

server.on('listening', function() {
    console.log('Node app is running on port', app.get('port'));
});

server.on('error', function(err) {
    console.log('Server error =>', err);
});