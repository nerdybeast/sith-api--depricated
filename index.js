//default node.js modules
var http = require('http');

//npm installed packages
var express = require('express');
var morgan = require('morgan');
//var debug = require('debug')('SITH-API'); //not working
var cookieParser = require('cookie-parser'); //middle-ware that allows easy manipulation of cookies incoming/outgoing
var bodyParser = require('body-parser'); //middle-ware that allows easy manipulation of request/response bodies

var app = express();

app.set('port', (process.env.PORT || 5000));
//debug(app.get('port'));

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


app.get('/', function(request, response) {
  response.render('pages/index');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
