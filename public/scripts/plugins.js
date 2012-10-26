/**
 * Cloudspokes challenge #1840 - front-end application (plugins)
 * 
 * This file contains helpers, managers, utilities used in the application.
 *
 *	- ServerApi
 *	- Pusherpipe (not the real-deal! just one-way, server sent events...)
 *	- CanvasDO
 *	- Logger
 *	- ErrorSink
 *	
 * @author daniel@bitbay.org
 * 
 */


/**
 * ServerApi
 *
 * Helper class to communicate with the back-end services
 *
 */
var ServerApi = (function() {
	/* SETTINGS FOR THE PLUGIN */
	var serverApi = {
		// error messages used by the module
		errors: {
			REST_FAIL: 'There was a problem communicating with the server'
		}
	};
	
	/**
	 * calculateIris
	 *
	 * Sends the selected img url to the backend, and that kicks off the
	 * opencv processing.
	 *
	 * @param {string} the name of the selected image to process
	 */
	function calculateIris(src){
		var url = "/calculate/?src=" + escape(src);
		xhr = new XMLHttpRequest();
		xhr.open('POST', url, true);
		// sending back channel session variable for authentification
		xhr.setRequestHeader('X-Visitor', SESSION_VARS.channel);
		xhr.send();
	}
	
	/**
	 * HandleFilesUpload
	 *
	 * Takes care of the file-upload requests
	 */
	 function handleFilesUpload( evt ){
	 	var file = evt.target.files[0]; // FileList object
		if( !file ) return false;
		
		// limit the file size to 5 megabytes
	 	if( file.size > 5242880 ){
	 		Logger.log('Image too large', 'error');
	 		Logger.log('Max file size 5Mb', 'error');
	 		return false;
	 	}
	 	
	 	var formData = new FormData();
	 	formData.append('image', file);
	 	
	 	xhr = new XMLHttpRequest();
		xhr.open('post', '/upload', true);
		// Set header with channel name
		xhr.setRequestHeader('X-Visitor', SESSION_VARS.channel);
		
		// track progress
		var onProgress = function(e) {
			if (e.lengthComputable) {
				var msg = 'Uploaded ' + (e.loaded/e.total)*100 + '%'
				Logger.log(msg);
			}
		};
		// File uploaded
		xhr.addEventListener("load", function () {
			Logger.log("Uploaded file");
		}, false);
		
		// Send the formData containing the file
		xhr.send(formData);
	 }
	 
	/**
	 * Finishes the authorization process, confirming that user has finished 
	 * connecting to the channel.
	 */
	function handshake(){
		var xhr = new XMLHttpRequest();
		xhr.open('POST', document.location+'handshake');
		xhr.setRequestHeader('X-Visitor', SESSION_VARS.channel);
		xhr.send();
	};
	
	/* Public methods exposed for Server API */
	return {
		errors: serverApi.errors,
		handshake: handshake,
		handleFiles: handleFilesUpload,
		calculateIris: calculateIris
	};
})();

/**
 * Pusherpipe object
 *
 * The pusher using websockets for server-client communication.
 */
var Pusherpipe = (function(){
	var channel;
	var pusher;
	
	/**
	 * Registering channel event binders
	 *
	 */
	// handshake done
	var greetHandler = function (data) {
		Logger.log(data.msg, 'server');
	};
	
	// uploaded image ready to use
	var recieveUploadedImages = function (images){
		Logger.log(images.msg, 'server');
		CSC1840.appendImages(images.data);
	};
	
	
	/**
	 * Initialize the Pusher instance, and setup channel bindings
	 *
	 * Probably could be better organized as in terms of bind/unbind, based on
	 * current application state, but for now it sets up all.
	 *
	 * With the new pipes api of pusher, no need for the REST style
	 * communication (not in this app)
	 * See: http://pusher.com/docs/pipe
	 */
	var init = function(){
		// uncomment to recieve debugging logs from the push.com server
		/*
		Pusher.log = function(message) {
			if (window.console && window.console.log) {
				window.console.log(message);
			}
		};
		*/
		
		// set auth endpoint to the back-end route
        Pusher.channel_auth_endpoint = SESSION_VARS.authEndPoint;
        
		// uses CSC1840 API KEY
		this.pusher = new Pusher(SESSION_VARS.pusherKey);

		// triggers the 'auth' server endpoint
		this.channel = this.pusher.subscribe('private-'+SESSION_VARS.channel);
		// kick off connections...
		this.channel.bind('pusher_internal:subscription_succeeded',
			ServerApi.handshake);
		
		/* Application logic */
		
		/**
		 * Controllers listening to server-pushed events
		 *
		 *	-server-greet:	the server registered the visitor
		 *	-server-uploaded-images:	the server recovered user saved images
		 *								(for now without actual registration/login)
		 *	-server-error/server-info:	generic channels for communicating events
		 *	-server-update:	the last uploaded image is saved on the back-end and
		 *					ready to use in the app
		 *	-opencv-info/opencv-error:	generic channel of opencv processing results
		 */
		 
		// handshake - greet
		this.channel.bind('server-greet', this.greetHandler);
		
		// needs: uploaded images urls
		this.channel.bind('server-uploaded-images', this.recieveUploadedImages);
		this.channel.bind('server-error', function(data){
			console.log(data);
		});
		this.channel.bind('server-info', function(data){
			Logger.log(data.msg);
		});
		this.channel.bind('server-update', function(data){
			if( data.url ) CSC1840.appendImages([data]);
		});
		
		this.channel.bind('opencv-info', function(data){
			Logger.log(data.msg, 'opencv');
		});
		
		this.channel.bind('opencv-result', function(data){
			if( data.roi ){
				CanvasDO.eyesROI = data.roi.eyes;
				CSC1840.drawRoi();
			}
			if( data.iris ){
				CanvasDO.irises = data.iris;
				CSC1840.drawImage();
			}
		});
		
		/* Pusher.com debug messages */
		
		this.pusher.connection.bind('connecting', function() {
			//$('div#status').text('Connecting to Pusher...');
			Logger.log('Connecting to Pusher...', 'pusher');
		});

		this.pusher.connection.bind('connected', function() {
			//$('div#status').text('Connected to Pusher!');
			Logger.log('Connected to Pusher!', 'pusher');
		});

		this.pusher.connection.bind('failed', function() {
			//$('div#status').text('Connection to Pusher failed :(');
			Logger.log('Connection to Pusher failed', 'pusher');
		});
		
		this.channel.bind('subscription_error', function(status) {
			Logger.log('Pusher subscription_error', 'pusher');
			if(status == 408 || status == 503){
				// if the error is temporary...
				Logger.log('Retrying in 2 seconds...', 'pusher');
				setTimeout( function(){
					this.channel = this.pusher
						.subscribe('presence-'+SESSION_VARS.channel);
				}, 2000);	
			}
		});
		
		// show-stopper
		this.pusher.connection.bind( 'error', function( err ) { 
			if( err.data.code === 4004 ) {
				Logger.log('Detected pusher.com limit error', 'pusher');
			} else {
				Logger.log('Could not connect to pusher...', 'pusher');
			}
		});
	}
	
	/* Public methods exposed for Pusher */
	return {
		init: init,
		greetHandler: greetHandler,
		recieveUploadedImages: recieveUploadedImages
	}
})();

/**
 * CanvasDO 
 *
 * Data Object (okai, with some loader logic to cache) for the canvas, with
 * R/W members the drawing function needs to redraw the actual stage at any
 * given moment (window.onresize, etc)
 */
var CanvasDO = (function(){
	this.imageURL = '';
	this.eyesROI = [];
	this.irises = [];
	this.pupils = [];
	this.actualScale;
	this.originalImageRect = {};
	
	/* calculate 'letterbox' format to fit-scale the image in the 'stage'
	 * container
	 *
	 * @param {object}	width/height of the 'outer' container - bounds
	 *					(containing the canvas)
	 * @param {object}	optional object (img || {}) with width/height fields,
	 * 					the 'inner' component to resize
	 */
	this.correctedTransform = function(rect, image){
		// save the original rect of image dimensions
		this.originalImageRect = { width: image.width, height: image.height };
		
		var iW = image.width;
		var iH = image.height;
		var cW = rect.width;
		var cH = rect.height;
		var cR = cW / cH;		// container AspectRatio
		var iR = iW / iH;		// image AspectRatio
		
		var width;
		var height;
		var scale;
		var x,y;
		if( cR < iR ){
			// calc width, multiply height
			if( iW > cW ){
				// scale down width...
				scale = cW/iW;
				width = cW;
				height = cW/iR;
				x = 0;
				y = (cH-height)*0.5;
			}else{
				// center only
				scale = 1;
				width = iW;
				height = iH;
				x = (cW-width)*0.5;
				y = (cH-height)*0.5;
			}
		}
		else{
			// calc height, multiply width
			if( iH > cH ){
				// scale down height...
				scale = cH/iH;
				width = cH*iR;
				height = cH;
				x = (cW-width)*0.5;
				y = 0;
			}else{
				// center only
				scale = 1;
				width = iW;
				height = iH;
				x = (cW-width)*0.5;
				y = (cH-height)*0.5;
			}
		}
		this.actualScale = scale;
		return {x:x, y:y, width:width, height:height, scale:scale};
	};
	
	return this;
})();
 
/**
 * Logger
 *
 * System-wide message handler - presenting them to the user.
 */
var Logger = (function() {
	// default on-screen time for a message
	var defaultTimeout = 3000;
	var logs = {};
	var spans = [];
	
	/**
	 * Logs the recieved message to the output buffer/element.
	 *
	 * @param {string}	the message to show.
	 * @param {string} 	optional name of the source of message
	 */
	function pushMessage(msg, src){
		// store the message in an all-time-log
		var time = new Date();
		var UTCstring = time.toUTCString();
		var sender = typeof src === 'undefined' ? 'anon' : src;

		// messages are colored with CSS based on sender.
		logs[ UTCstring ] = {
			'sender': sender,
			'message': msg
		};
		
		// append the message to the aside (msg container)
		var el = document.querySelector('aside');
		var span = document.createElement('span');
		var text = document.createTextNode(msg);
		span.className = sender;
		span.appendChild(text);
		el.appendChild(span);
		
		// store the message span for later reference
		spans.push(span);
		
		// let the message be visible for defaultTimeout seconds
		setTimeout(function(){
			var span = spans.shift();
			span.parentNode.removeChild(span);
		},defaultTimeout);
	}
	
	/* Public methods exposed for Logger */
	return {
		log: pushMessage,
		logs: logs
	};
})();

/**
 * Global error handler.
 * 
 * Supresses known errors - passes on unknown errors
 * to default browser error handling.
 */
var ErrorSink = ( function(){
	/**
	 * Error handler
	 *
	 * @param {String} message of error
	 * @param {Srting} url of the offending script
	 * @param {Number} line of error
	 * 
	 * @return {Boolean} true for handled errors 
	 */
	function errorHandler(msg, url, line){
		// strip added string
		var error = msg.replace("Uncaught ","");
		switch(error){
			case CSC1840.errors.NO_SUPPORT:
				// handle 'could not get ticket' error
				console.log("CSC1840 [error]: " + error);
				break;
			default:
				// application can not handle error...
				// send to browser.
				return false;
		}
		// no browser error handling
		return true;
	};
	
	// trap browser error handler and redirect to app errorHandler
	window.onerror = errorHandler;
})();
