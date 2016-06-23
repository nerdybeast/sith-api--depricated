'use strict';

//default node.js modules
var http = require('http');

//npm installed packages
var express = require('express');
var morgan = require('morgan');
var cookieParser = require('cookie-parser'); //middle-ware that allows easy manipulation of cookies incoming/outgoing
var bodyParser = require('body-parser'); //middle-ware that allows easy manipulation of request/response bodies
var cors = require('cors');
let _ = require('lodash');

var app = express();

//Storing some custom settings on the Express object so that they can be accessed later if neccessary.
//NOTE: See http://expressjs.com/en/4x/api.html#app.settings.table for built-in Express settings. 
app.set('port', (process.env.PORT || 5000));

let server = app.listen(app.get('port'));
let io = require('socket.io')(server);

require('./lib/io-manager')(io);

//Set the io instance on the app so that we don't have to pass it as a function parameter to every module.
app.set('io', io);

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

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