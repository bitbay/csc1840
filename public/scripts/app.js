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
	
	// will contain the already calculated result to save processing on server.
	// TODO: implement...
	var calculatedCache = {};
	
	
	/* EVENT HANDLERS */
	
	/**
	 * handleNav
	 *
	 * User clicking on a button results in segmentation of the iris.
	 * Other clicks surpressed.
	 * 
	 * @param {event}	mouseClick event
	 */
	function handleNav(evt){
	 	if(evt.target.nodeName == 'IMG' && evt.target.className != 'selected' ){
	 		var prev = document.querySelector('.selected');
	 		if( prev ) prev.className = '';
	 		evt.target.className = 'selected';
	 		
	 		ViewManager.imageURL = evt.target.src;
			ViewManager.setState( 'LOADING_STATE');
	 	}
	}
	 
	/**
	 * handleResize
	 *
	 * by resizing the window the canvases needs to be cleared, ocasionally 
	 * redrawn (depending on the state the app is Viewing/Coloring)
	 *
	 * @param {event}	the window resize event
	 */
	function handleResize(evt){
		var canvas0 = document.querySelector('#layer0');
		var canvas1 = document.querySelector('#layer1');
		ViewManager.clearCanvas(canvas0);
		ViewManager.clearCanvas(canvas1);

		if( ViewManager.state === 'EDITING_STATE' ){
			ViewManager.drawImage(canvas0);
			ViewManager.drawMask(canvas1);
		} else if ( ViewManager.state !== 'INIT_STATE' ){
			ViewManager.drawImage( canvas1);
		}
	}
	
	/**
	 * handles the change of the controller inputs, delegating values to the 
	 * ViewManager class
	 *
	 * @param {event}	the change event fired by the input
	 */
	function handleController(evt){
		var inputId = evt.target.id;
		ViewManager.setFilter( inputId, evt.target.value );
	}
	
	/**
	 * appendImages
	 *
	 * Appends the recieved images to the nav element, ready for selecting
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
			var title = !images[i].title ? 'User_'+i : images[i].title;
			img.src = './data/upload/' + images[i].url;
			img.alt = title;
			
			var figCap = document.createElement('figcaption');
			var text = document.createTextNode(title);
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
		
		// form post - upload selected image...
		document.querySelector('form>input').addEventListener('change',
			ServerApi.handleFiles, false);
			
		// navigation - select image to process...
		document.querySelector('nav').addEventListener('click',
			CSC1840.handleNav);

		// filters input - change iris color/redraw...
		document.querySelector('#controller').addEventListener('change',
			CSC1840.handleController, true);
			
		// window resize - redraw canvas...
		//window.onresize = CSC1840.handleResize;
		window.addEventListener( 'resize', CSC1840.handleResize, true);

		// trigger window resize to set initial size
		var evt = document.createEvent('UIEvents');
		evt.initUIEvent('resize', true, false,window,0);
		window.dispatchEvent(evt);
	};
	/* Expose public methods and variables */
	return {
		run: run,
		appendImages: appendImages,
		handleNav: handleNav,
		handleResize: handleResize,
		handleController: handleController
	};
}());

// bootstrap the application on window load
window.onload=function(){
	// run the application
	CSC1840.run();
};
