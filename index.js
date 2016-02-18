//default node.js modules
var http = require('http');

//npm installed packages
var express = require('express');
var morgan = require('morgan');
var cookieParser = require('cookie-parser'); //middle-ware that allows easy manipulation of cookies incoming/outgoing
var bodyParser = require('body-parser'); //middle-ware that allows easy manipulation of request/response bodies

var app = express();

app.set('port', (process.env.PORT || 4000));

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function(req, res) {
    res.send({
        port: app.get('port'),
        env: process.env.NODE_ENV
    });
});

var server = http.createServer(app);

server.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});

server.on('error', function(err) {
    console.log('Server error =>', err);
});

server.on('listening', function() {
    console.log('Server listening');
});