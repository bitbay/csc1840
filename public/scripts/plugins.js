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
	 */
	function pushMessage(msg){
		// store the message in an all-time-log
		var time = new Date();
		var UTCstring = time.toUTCString();
		logs[ UTCstring ] = msg;
		
		// append the message to the aside (msg container)
		var el = document.querySelector('aside');
		var span = document.createElement('span');
		var text = document.createTextNode(msg);
		span.appendChild(text);
		el.appendChild(span);
		
		// store the message span for later reference
		spans.push(span);
		
		setTimeout(function(){
			var span = spans.shift();
			span.parentNode.removeChild(span);
		},defaultTimeout);
	}
	
	/* Public methods exposed for Server API */
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
