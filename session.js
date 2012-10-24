/**
 * session.js
 * 
 * Middleware for simple session management, keeping track of the files uploaded
 * by the user.
 *
 * Uses mongoDB as database and mongojs as driver.
 *
 * @author	daniel@bitbay.org
 * @version
 */

// mongodb access parameters, set by mongolab heroku add-on or locally
var databaseUri = process.env.MONGOLAB_URI || 'csc1840', 
	collections = ['visitors'];
	
// going to use these...
var db = require('mongojs').connect(databaseUri, collections),
	ObjectId = require('mongojs').ObjectId,
	crypto = require('crypto'),
	q = require('q'),
	pusher = require('./pusher.js'),
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
	if(typeof req.session.channelId == 'undefined')
	{
		sys.puts('has no session: ' + req.session.id);
		// create a mongodb entry for the session and get the _id
		// this _id will allow to subscribe a user to his own channel
		var dbresult = storeSessionId(req.session.id);
		sys.puts('result:' + dbresult);
		switch(dbresult.status){
			case 200:
				// OK
				req.session.channelId = dbresult.channelId;
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

/**
 * Authentication backend 
 *
 * Authenticates user checking mongodb against channel_name.
 * Sets the response content to 
 */
// Authenticate using stored mongodb values...
exports.auth = function (req, res) {
	var channel = req.body.channel_name.replace('private-', '');
	
	var find = q.defer();
	db.visitors.find({
		channel : channel
	}, find.makeNodeResolver());

	var result;

	// resolved promise
	find.promise.then(function(visitors) {
		if (visitors.length === 1) {
			// we have a visitor!
			var authObj = pusher.auth(req.body.socket_id, req.body.channel_name);
			res.status(200).json(authObj);
		} else if (visitors.length === 0) {
			// not registered...
			// authentication failed...
			// status code 401 : Unauthorized
			res.status(401).end();
		} else {
			// ILLEGAL! CORRUPTED DATABASE
			// the email can't appear more than once in the collection!
			// status code 500 : Internal Server Error
			res.status(500).end();
		};
	}, function(err) {
		// DB error...
		// status code 503 : Service Unavailable
		res.status(503).end();
	});
};


/**
 * queryImages
 *
 * searches already uploaded images in the users session history
 *
 * @param {string} the id of the ongoing session
 * @return {object} the result of the query
 */
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
	var buf;
  	try {
		buf = crypto.randomBytes(32).toString('hex');
	} catch (ex) {
		// handle error
	}
	return buf;
};

/**
 * storeSessionId
 *
 * Stores the generated id in the database, needed to access services of the
 * application
 * assert (session_save_done)
 *
 * @param {string}	the req.session.id
 * @param {function} callback on finish
 * @return {number} http response code 
 */
function storeSessionId(sessionId) {
	var result = {
		status: 0,
		channelId: undefined
	};
	// check if we have already a session with this id...(probably not)
	db.visitors.find({ sessionId : sessionId }, function(err, visitors) {
		// DB error...
		// status code 503 : Service Unavailable
		if (err) {
			result.status = 503;
			return result;
		}
		
		// session already exists...
		// status code 410 : Gone
		if (visitors.length > 0){
			result.status = 410;
			return result;
		}
	});
	
	// generate a random channel for the session/user
	var channelId = getRandomId();
	
	db.visitors.save({ sessionId: sessionId, channel: channelId }, { safe : true }, function(err, saved) {
		// DB error...
		// status code 503 : Service Unavailable
		if(err){
			result.status = 503;
			return result;
		}
	});
	
	// new session saved...
	result.status = 200;
	result.channelId = channelId;
	sys.puts(JSON.stringify(result));
	return result;
};


