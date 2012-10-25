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
	
	/**
	 * handleNav
	 *
	 * User clicking on a button results in segmentation of the iris.
	 * Other clicks surpressed.
	 * 
	 */
	 function handleNav(evt){
	 	if(evt.target.nodeName == 'IMG'){
	 		var prev = document.querySelector('.selected');
	 		if( prev ) prev.className = '';
	 		evt.target.className = 'selected';
	 		ServerApi.calculateIris(evt.target.src);
	 	}
	 }
	 
	/**
	 * appendImages
	 *
	 * Appends the recieved images to the nav element
	 *
	 * @param {array} the images associated with the session
	 */
	function appendImages(images){
		// the navigation and form element
		var nav = document.querySelector('nav');
		
		var i = 0;
		for(i; i<images.length; ++i){
			var fig = document.createElement('figure');
			var img = document.createElement('img');
			var title = images[i].title == undefined ? 'User-'+i : images[i].title;
			img.src = './data/upload/' + images[i].url;
			img.alt = title;
			
			var figCap = document.createElement('figcaption');
			var text = document.createTextNode(images[i].title);
			figCap.appendChild(text);
			fig.appendChild(img);
			fig.appendChild(figCap);
			nav.appendChild(fig);
		}
	}
	
	/* MAIN */
	
	function run(){
		Logger.log('Application startup');
		
		// init classes
		Pusherpipe.init();
		
		// setup eventhandlers
		document.querySelector('form>input').addEventListener('change',
			ServerApi.handleFiles, false);
		document.querySelector('nav').addEventListener('click',
			CSC1840.handleNav);
	};
	/* Expose public methods and variables */
	return {
		run: run,
		appendImages: appendImages,
		handleNav: handleNav
	};
}());

window.onload=function(){
	// run the application
	CSC1840.run();
};
