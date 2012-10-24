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
	async = require('async'),
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
		// check if was page refresh
		var find = q.defer();
		db.visitors.find({
			sessionId : req.session.id
		}, find.makeNodeResolver());
		
		find.promise.then(function(visitors) {
			if (visitors.length === 0) {
				// not page refresh, does not have a session/channel
				// generate a random channel
				var channelId = getRandomId();
				
				// save in the db
				var save = q.defer();
				db.visitors.save({ sessionId: req.session.id,
					channel: channelId }, save.makeNodeResolver());

				save.promise.then(function(saved) {
					// new session registered...
					req.session.channelId = channelId;
					next();
				}, function(err) {
					// DB error...
					// status code 503 : Service Unavailable
					res.status(503).end("FAILED TO SAVE SESSION");
				});
			} else {
				// user already has a session
				req.session.channelId = visitor.channelId;
			}
		}, function(err) {
			// DB error...no grace at all!
			// status code 503 : Service Unavailable
			res.status(503).end("FAILED TO FETCH USER DB");
		});	
	}else{
		sys.puts('already has session: ' + req.session.id);
		console.log('calling next');
		next();
	}
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
 * handshake
 *
 * last confirmation before actual data transfer begins
 */
exports.handshake = function (req, res){
	var visitor = req.get('X-Visitor');
	if( req.session.channelId === visitor ){
		// greet the user
		var channel = 'private-'+visitor;
		pusher.trigger( channel, 'greet', {msg:'Welcome!'});
		res.status(200).send('Hello');
		queryImages(req.session.channelId );
	}else{
		res.send(401,'Who are You stranger?').end();
	}
};

/**
 * queryImages
 *
 * searches already uploaded images in the users session history
 *
 * @param {string} the id of the ongoing session
 * @return {object} the result of the query
 */
var queryImages = function (channelId) {
	// check if we have already a session with this id...(probably not)
	var find = q.defer();
	db.visitors.find({
		channel : channelId
	},find.makeNodeResolver());
	
	find.promise.then(function(visitors) {
		if (visitors.length === 1) {
			var visitor = visitors[0];
			
			// Return the images...
			var images = [{ url: 'public/data/upload/woman.jpg',
				 			title: 'Sample'}];
			var i=0;
			for(i; i<visitor.images; ++i){
				images.push({ url: visitor.images[i],
				 			  title: ('User-'+i)});
			}
			pusher.trigger( 'private-'+channelId, 'send-uploaded-images',
							{ data: images, msg: 'Images recovered' });
		} else {
			// something got badly messed up!
			// DB error...
			// status code 500 : Internal error
			pusher.trigger( 'private-'+channelId, 'server-error', {status:500});
		}
	}, function(err) {
		// DB error...
		// status code 503 : Service Unavailable
		pusher.trigger( 'private-'+channelId, 'server-error', {status:500});
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
