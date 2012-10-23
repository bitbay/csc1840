/**
 * session.js
 * 
 * Middleware for simple session management, keeping track of the files uploaded
 * by the user.
 *
 * Uses mongoDB as database and mongojs as driver.
 *
 * @author daniel@bitbay.org
 * @version
 */

// mongodb access parameters
var databaseUri = process.env.MONGOLAB_URI || 'csc1840', // set by mongolab heroku add-on
	collections = ['visitors'];
	
// going to use these...
var db = require('mongojs').connect(databaseUri, collections),
	ObjectId = require('mongojs').ObjectId,
	q = require('q'),
	sys = require('sys');

/**
 * preroute
 *
 * As there is no real user management (register/login) present in the
 * application, this simple middleware is used for session data handing.
 * 
 * First time a user connects to the application/page, he/she gets a USERID
 * that will be used to create a channel of messages the user subscribes to,
 * to recieve various server/application events.
 * 
 * @param {object}	the request object containing the session
 * @param {object}	the response object
 * @param {function}	the next middleware in the route
 */
exports.preroute = function(req, res, next){
	if(typeof req.session.registered == 'undefined')
	{
		sys.puts('has no session: ' + req.session.id);
		// create a mongodb entry for the session and get the _id
		// this _id will allow to subscribe a user to his own channel
		var dbresult = storeSessionId(req.session.id);
		switch(dbresult){
			case 200:
				// OK
				req.session.registered = true;
				break;
			case 410:
				// already has registered/valid session entry
				break;
			default:
				// something went wrong
				// retry...continous fails result in redirection circle!
				res.status(err);
				if(err === 307) res.setHeader('Location', '/');
				return next(new Error('Session registering failed.'));
				break;
		}
		
	}else{
		sys.puts('already has session: ' + req.session.id);
	}
	next();
}

exports.queryImages = function (sessionId) {
	// check if we have already a session with this id...(probably not)
	var find = q.defer();
	db.visitors.find({
		sessionId : sessionId
	}, function(err, visitors) {
		if (err){
			// DB error...
			// status code 503 : Service Unavailable
			return 503;
		}
		if (visitors.length === 1) {
			sys.puts(JSON.stringify(visitor));
			// Return the images...
			return [];
		} else {
			// session already exists...
			// status code 410 : Gone
			return 410;
		}
	}, function(err) {
		// DB error...
		// status code 503 : Service Unavailable
		return 503;
	});
};

/**
 * getRandomId
 *
 * Simple random ID generator using 'crypto'
 *
 * @return {string}	64 bytes long random id, should be enough for now...
 */
function getRandomId(){
	// syncronous  calling crypto...
  	try {
		var buf = crypto.randomBytes(32).toString('hex');
	} catch (ex) {
		// handle error
	}
};

/**
 * storeSessionId
 *
 * Stores the generated id in the database, needed to access services of the
 * application - this one needs to be syncronous!
 * assert (session_save_done)
 *
 * @param {string}	the req.session.id
 * @param {function} callback on finish
 * @return {number} http response code 
 */
function storeSessionId(sessionId) {
	// check if we have already a session with this id...(probably not)
	db.visitors.find({ sessionId : sessionId }, function(err, visitors) {
		// DB error...
		// status code 503 : Service Unavailable
		if (err) return 503;
		
		// session already exists...
		// status code 410 : Gone
		if (visitors.length > 0) return 410;
	});
	
	db.visitors.save({ sessionId: sessionId }, { safe : true }, function(err, saved) {
		// DB error...
		// status code 503 : Service Unavailable
		if(err) return 503;
	});
	
	// new session saved...
	return 200;
};


