/**
 * web.js - Web server with routing and RESTful API
 *
 * Uses express for the main framework, mongodb for database.
 *
 * author: daniel@bitbay.org
 */

// heroku environment || local
var port = process.env.PORT || 3000;

/* Module dependencies. */
var	express = require('express'),
	path = require('path'),
	routes = require('./routes'),
	sessionManager = require('./session.js'),
	sys = require('sys');

var app = module.exports = express();

sys.puts(path.join(__dirname, '/public'));
/* Application constants (setup) */
app.set('port', port);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.set('uploads', __dirname + '/public/data/upload');
//app.set('source', __dirname + '/source');

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

// Swallow the rest of requests at the end
app.get('*', routes.index);

/* Startup application */
if (!module.parent) {
	app.listen(app.get('port'));
	console.log('Express started on port '+ app.get('port'));
}
