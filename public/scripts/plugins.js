/**
 * Cloudspokes challenge #1840 - front-end application (plugins)
 * 
 * This file contains helpers, managers, utilities used in the application.
 *
 *	- ServerApi
 *	- Pusherpipe (not the real-deal!)
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
 * The pusher using websockets for bi-directional server-client communication.
 */
var Pusherpipe = (function(){
	var channel;
	var pusher;
	
	/**
	 * Registering channel event binders
	 *
	 */
	var greetHandler = function (data) {
		Logger.log(data.msg, 'server');
	};
	
	var recieveUploadedImages = function (images){
		Logger.log(images.msg, 'server');
		CSC1840.appendImages(images.data);
	};
	
	
	/**
	 * Initialize the Pusher instance, and setup channel bindings
	 *
	 * Probably could be better organized as in terms of bind/unbind based on
	 * current application state, but for now it sets up all.
	 *
	 * With the new pipes api of pusher, no need for the REST style
	 * communication (not in this app)
	 * See: http://pusher.com/docs/pipe
	 */
	var init = function(){
		/*
		Pusher.log = function(message) {
	  	if (window.console && window.console.log) {
			window.console.log(message);
		  }
		};
		*/
		//Pusher.host = "ws.darling.pusher.com";
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
					this.channel = this.pusher.subscribe('presence-'+SESSION_VARS.channel);
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
 * Supresses known errors, passes on unknown errors
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
