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
	opencvMain = require('./opencv.js'),
	path = require('path');

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
				
				var defaultImage = [{ 
					'url': 'woman.jpg',
				 	'title': 'Sample'
				 }];
				
				// save in the db
				var save = q.defer();
				db.visitors.save({ sessionId: req.session.id,
					channel: channelId, images: defaultImage },
					save.makeNodeResolver());

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
		// already has session
		next();
	}
}

/**
 * Authentication backend 
 *
 * Authenticates user checking mongodb against channel_name.
 * Sets the response content to 200 OK || 401 Not authorized || 500 Server error
 */
exports.auth = function (req, res) {
	var channel = req.body.channel_name.replace('private-', '');
	
	// Authenticate using stored mongodb values...
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
	var channel = 'private-'+visitor;
	
	if( req.session.channelId === visitor ){
		// greet the user
		pusher.trigger( channel, 'server-greet', {msg:'Welcome!'});
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
			pusher.trigger( 'private-'+channelId, 'server-uploaded-images',
							{ data: visitor.images, msg: 'Images recovered' });
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
 * fileupload
 *
 * Uploads the file into target directory, saves the reference in users db entry
 * and triggers event on pusher notifing
 */
exports.fileupload = function(req, res){
	var visitor = req.get('X-Visitor');
	var channel = 'private-'+visitor;
	
	var find = q.defer();
	db.visitors.find({
		sessionId : req.session.id
	}, find.makeNodeResolver());

	// resolved promise
	find.promise.then(function(visitors) {
	
		if (visitors.length == 1) {
			// get selected visitor
			var visitor = visitors[0];
			
			// get possible images already set
			var imagesNow = visitor.images;

			// get just uploaded filename
			var url = req.files.image.path;
			var upstreamName = url.substring(url.lastIndexOf('/')+1);			
			imagesNow.push( {url: upstreamName} );
			
			// save img location in the db
			var save = q.defer();
			db.visitors.update({sessionId:req.session.id},
				{ $set : {images: imagesNow }}, save.makeNodeResolver());

			save.promise.then(function(saved) {
				// updated images of user
				pusher.trigger( channel, 'server-update',
					{status:200, url:upstreamName});
				pusher.trigger( channel, 'server-info',
					{msg:'Uploaded image.'});
				res.status(200).end();
			}, function(err) {
				// DB error...
				// status code 503 : Service Unavailable
				res.status(503).end();
			});
		} else {
			// DB error...
			// status code 503 : Service Unavailable
			res.status(503).end();
		}
	});
};

/**
 * opencv
 *
 * The iris segmentation class (wrapper)
 *
 * Runs in two phases, first it detects the Region of Interest, and then
 * works with the encountered ROIs through a series of filters to finally
 * extract the circle corresponding to the iris.
 *
 * ..first runs a basic sanity check.
 */
exports.opencv = function(req, res){
	var src = req.query.src;
	// calculate the absolute path of the image
	var fileName = path.basename(src);
	var absSrc = path.resolve('./public/data/upload/' + fileName);
	
	var visitor = req.get('X-Visitor');
	var channel = 'private-'+visitor;
	
	/**
	 * now THIS would be an ideal place to fork a new child_process, to use the
	 * power of scalable multi-threaded environment for cloud-computing, but
	 * unfortunatly on heroku for free it can't be done...
	 */
	/*
	process.nextTick(function(){pusher.trigger( channel, 'server-info', {msg:'Loading OpenCV'})});
	process.nextTick(function(){require('./opencv.js').opencv(absSrc, channel)});
	*/
	pusher.trigger( channel, 'server-info', {msg:'Loading OpenCV'});
	var cp = require('child_process');
	var n = cp.fork(__dirname + '/opencv_cp.js');

	n.send({ src: absSrc, channel:channel});
	
	
	res.status(200).end();
}

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
