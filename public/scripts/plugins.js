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
 * See:
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
	
	function getImages(callBack){
		
	};
	
	/* Public methods exposed for Server API */
	return {
		errors: serverApi.errors,
		getImages: getImages
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
		
		// get images from server ( default && already uploaded )...
		// ServerApi.getImages(CSC1840.imagesRecieved);
		var triggered = Pusherpipe.channel.trigger('client-needs-uploaded-images',{});
		if( !triggered ) {
			Logger.log('Failed to fetch images!', 'pusher');
		};
	};
	
	var recieveUploadedImages = function (data){
		Logger.log(data.msg, 'server');
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
		//Pusher.host = "ws.darling.pusher.com";
		// set auth endpoint to the back-end route
        Pusher.channel_auth_endpoint = SESSION_VARS.authEndPoint;
        
		// uses CSC1840 API KEY
		this.pusher = new Pusher(SESSION_VARS.pusherKey);

		// triggers the 'auth' server endpoint
		this.channel = this.pusher.subscribe('private-'+SESSION_VARS.channel);
		
		
		/* Application logic */
		
		// handshake - greet
		this.channel.bind('greet', this.greetHandler);
		
		// needs: uploaded images urls
		this.channel.bind('send-uploaded-images', this.recieveUploadedImages);
		
		
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
					this.channel = this.pusher.subscribe('private-'+SESSION_VARS.channel);
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
		greetHandler: greetHandler
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
		log: pushMessage
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
	
		// hide content, show error
		/*
		$('#content').addClass('hidden');
		$('#alert').removeClass('hidden');
		$('#alert span').text(error);
		*/
		// no browser error handling
		return true;
	};
	
	// trap browser error handler and redirect to app errorHandler
	window.onerror = errorHandler;
})();
