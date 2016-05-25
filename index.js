'use strict';

//default node.js modules
var http = require('http');

//npm installed packages
var express = require('express');
var morgan = require('morgan');
var cookieParser = require('cookie-parser'); //middle-ware that allows easy manipulation of cookies incoming/outgoing
var bodyParser = require('body-parser'); //middle-ware that allows easy manipulation of request/response bodies
var cors = require('cors');

var app = express();

//app.set('port', (process.env.PORT || 5000));
let server = app.listen((process.env.PORT || 5000));
let io = require('socket.io')(server);

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

// //Automatically loads routes/index.js, see:
// //https://nodejs.org/api/modules.html#modules_folders_as_modules
// require('./routes')(app);

//var server = http.createServer(app);

//Automatically loads routes/index.js, see:
//https://nodejs.org/api/modules.html#modules_folders_as_modules
require('./routes')(app, io);

//server.listen(app.get('port'));

server.on('error', function(err) {
    console.log('Server error =>', err);
});

server.on('listening', function() {
    console.log('Node app is running on port', app.get('port'));
});

io.on('connection', (socket) => {
    
    console.log('Client Connected');
    
    //Will emit to just the new client that has connected.
    socket.emit('debug-from-server', { message: 'Welcome new client!' });
    
    //Will emit to all clients that are connected.
    io.emit('debug-from-server', { message: 'Hey everyone, there is a new client!' });
    
    socket.on('debug-from-client', function(from, data) {
       console.log(`Received message from ${from} =>`, data);
    });
});