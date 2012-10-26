/**
 * Cloudspokes challenge #1840 - back-end server
 * 
 * web.js - Web server with routing and RESTful API
 *
 * Features:
 *	- express for the main framework
 *	- mongodb for database
 *	- pusher for server sent events
 *	- opencv (special build for heroku, compiled with vulcan), non-blocking,
 *	  scalable, forked child-processes
 * 
 * @author	daniel@bitbay.org
 * @version
 */

// heroku environment || local
var port = process.env.PORT || 3000;


/* Module dependencies. */

var	express = require('express'),
	path = require('path'),
	routes = require('./routes'),
	sessionManager = require('./session.js'),
	pusher = require('./pusher.js'),
	pusher_server = require('./pusher_server.js'),
	cv = require('opencv-node'),
	// module of object detection (faces && eyes)
	Detector = require('./detector'),
	sys = require('sys'),
	fs = require('fs');

var Mat = cv.Mat;
var app = module.exports = express();

/* Application constants (setup) */

app.set('port', port);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('uploads', __dirname + '/public/data/upload');
app.set('view cache', false);
//app.set('source', __dirname + '/source');

/**
 * mustKillCache middleware
 *
 * needed, to not let the client cache REST calls
 */
var mustKillCache = function (req, res, next) {
	if (req.url === '/') {
		res.header("Cache-Control", "no-cache, no-store, must-revalidate");
		res.header("Pragma", "no-cache");
		res.header("Expires", 0);
	}
	next();
}

/* MiddleWare stack */

app.configure(function(){
	app.use(express.logger('dev'));
	app.use(express.bodyParser({
		keepExtensions: true,
		uploadDir: app.get('uploads') }));
	app.use(express.limit('5mb'));
	app.use(express.methodOverride());
	app.use(express.cookieParser('supasecret')); // not so...
	app.use(express.session({
		cookie: {	maxAge: 60000 * 20, // 20 minutes
					secure: false,		// need https for this
					httpOnly: true,
					expires: false }
	}));
	
	/* No Cache Middleware for the API */
	app.use(mustKillCache);
	
	app.use(express.static(path.join(__dirname, '/public')));
	app.use(app.router);
	app.use(function(err, req, res, next){
		// handle registering session errors...
		if(res.statusCode === 307){
			res.send('Redirecting...');
		}else{
			next(err);
		}
	});
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.configure('production', function(){
  app.use(express.errorHandler()); 
});


/* Request routing */

// routing of the main pages to index.html - public access
app.get('/', sessionManager.preroute, routes.index);

// File upload:
app.post('/upload', sessionManager.fileupload);

// Opencv calculus trigger
app.post('/calculate', sessionManager.opencv );

/* Pusher messages */

// authorize endpoint
app.post('/auth', sessionManager.auth);
app.post('/handshake', sessionManager.handshake);


/* Startup application */
if (!module.parent) {
	app.listen(app.get('port'));
	console.log('Express started on port '+ app.get('port'));
}
