/**
 * Cloudspokes challenge #1840 - front-end application
 * 
 * Application used for visualizing/editing effects applied over a user uploaded
 * image file.
 *
 * Handles user inputs like file and color selection.
 * Recieves back-end events over websockets (Pusher).
 *
 * @author daniel@bitbay.org
 * 
 * See:
 */

// declaring module of the application, used to not pollute global space
var CSC1840 = ( function() {
	// defines error messages used/known by the errorHandler function
	var errors = {
		NO_SUPPORT : 'The ... APIs are not fully supported in this browser.'
	};
	
	function imagesRecieved(images){
		console.log('images recieved: ' + images.length);
	}
	
	/* PRIVATE METHODS */
	
	
	
	/* MAIN */
	
	function run(){
		Logger.log('Application startup');
		
		Pusherpipe.init();
		// Check for the various File API support.
		//if (!checkSupport()) throw(errors.NO_SUPPORT);
		
		// hide the loading message.
		//$('#loading').hide();
		
		// first check if user has a session/ticket
		/*
		if( !BoxApi.checkSession() ){
			// insufficient authorization, put login-redirect...
			$('#redirect').removeClass('hidden');
		} else {
			// trap the send event - stop page reload on submit			
			$('form').bind( 'submit', CSC1842.submitTrap );
			
			// handle file selection changes
			$('#files').change(handleFileSelect);
			
			// show form
			$('#fileform').removeClass('hidden');
		}
		*/
	};
	/* Expose public methods and variables */
	return {
		run: run
	};
}());

window.onload=function(){
	// run the application
	CSC1840.run();
};
