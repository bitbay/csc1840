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
	
	// reference to the image shown on screen, so that calculated events that
	// do not referr to this image, won't get drawn on screen...
	var onScreenImage = '';

	// will contain the already calculated result to save processing on server.
	// TODO: implement...
	var calculatedCache = {};
	
	// helper utility
	// @see: http://www.quirksmode.org/dom/getstyles.html
	function getStyle(el,styleProp)
	{
		return document.defaultView.getComputedStyle(el,null).
			getPropertyValue(styleProp);
	}
	
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
	 		ServerApi.calculateIris(evt.target.src);
	 		CanvasDO.imageURL = evt.target.src;

	 		// reset previous results
	 		CanvasDO.eyesROI = [];
			CanvasDO.irises = [];

	 		clearCanvas();
	 		drawImage();
	 	}
	}
	 
	/**
	 * handleResize
	 *
	 * by resizing the window the canvas needs to be redrawn and scaled.
	 *
	 * @param {event}	the window resize event
	 */
	function handleResize(evt){
		var section = document.querySelector('section');
		var controller = document.getElementById('controller');
	  	var canvas = document.querySelector('canvas');
	  	clearCanvas(canvas);
	  	drawImage();
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
	
	/**
	 * clearCanvas
	 *
	 * clears the canvas before drawing
	 *
	 * @param {canvasElement} optional reference to the canvas
	 */
	function clearCanvas( canvas ){
		if( !canvas ) canvas = document.querySelector('canvas');
		canvas.setAttribute('style', 'display:none;');
	  	var ctx = canvas.getContext('2d');
		// Store the current transformation matrix
		ctx.save();
		
		// Use the identity matrix while clearing the canvas
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Restore the transform
		ctx.restore();
	  	canvas.setAttribute('style', 'display:block;');
	  	canvas.width = 0;
	  	canvas.height = 0;
	}
	
	
	/**
	 * drawImage
	 *
	 * redraws the whole image
	 */
	function drawImage(){
		if( CanvasDO.imageURL == '' ) return false;
		var canvas = document.querySelector('canvas');
		
		var img = new Image();
		
		img.onload = function(){	
			//getStyle(canvas.parentNode, 'clientWidth');
			var padding = getStyle(canvas.parentNode.parentNode, 'padding');
			padding = parseInt(padding);
			var rect = { width:canvas.parentNode.parentNode.clientWidth-padding*2,
						 height: canvas.parentNode.clientHeight };
			var cT = CanvasDO.correctedTransform(rect, img);
			canvas.width = cT.width;
			canvas.height = cT.height;
			var ctx = canvas.getContext('2d');
			ctx.save();
			ctx.drawImage(	img,
							0, 0,
							cT.width, cT.height);
			ctx.restore();
			//canvas.setAttribute('style', 'position:relative; left:'+cT.x+'px; top:'+cT.y+'px;' );
			// check if results correspond to the actual on-screen-image
			if( CanvasDO.imageURL == img.src ) {
			  	if( CanvasDO.eyesROI ) drawRoi();
			  	if( CanvasDO.irises ) drawIris();
			}
		};
		
		img.src = CSC1840.onScreenImage = CanvasDO.imageURL;
		
	}
	
	/**
	 * drawRoi
	 *
	 * debug feature, that displays the detected Regions of interest (eyes)
	 */
	function drawRoi(){
		if( CSC1840.onScreenImage !== CanvasDO.imageURL ) return;
		// if drawing the iris too, not the debug regions...
		if( CanvasDO.irises.length !== 0 ) return;
		
		// getting scale modifier
		var sc = CanvasDO.actualScale;
		var canvas = document.querySelector('canvas');
		var ctx = canvas.getContext('2d');
		ctx.strokeStyle = "#F9F9F9";
		ctx.lineWidth = 1;
		function debugRoi(roi, index, array) {
			ctx.strokeRect(	roi.x*sc,roi.y*sc,
							roi.width*sc,roi.height*sc );
		}
		CanvasDO.eyesROI.forEach(debugRoi);
		
	};
	
	/**
	 * drawIris
	 *
	 * draws the iris over the eye, with the user selected color.
	 * 
	 * @param {color}	optional, selected color
	 */
	function drawIris(){
		// getting canvas-scale modifier
		var sc = CanvasDO.actualScale;
		var canvas = document.querySelector('canvas');
		var color = document.querySelector('#controller>input').value;
		
		function debugIris(iris, index, array) {
			if ( iris.length < 1 ) return;
			var ctx = canvas.getContext('2d');
			ctx.strokeStyle = color;
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			// regionOffset
			var rO = { x: CanvasDO.eyesROI[index].x*sc,
						y: CanvasDO.eyesROI[index].y*sc};
			ctx.beginPath();
			ctx.arc(parseInt(iris[0]*sc+rO.x),
					parseInt(iris[1]*sc+rO.y),
					parseInt(iris[2]*sc),
					0,Math.PI*2,false); // Outer circle
			ctx.stroke();
			//ctx.fill();
		}
		if ( CanvasDO.eyesROI.length > 0 )
			CanvasDO.irises.forEach(debugIris);
	};
	
	/**
	 * handles the change of the colorpicker element, redraws the eye regions
	 *
	 * @param {event}	the change event fired by the colorpicker
	 */
	function handleColor(evt){
		Logger.log('Color changed to '+evt.target.value);
		clearCanvas();
		drawImage();
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

		// color input - change iris color/redraw...
		document.querySelector('#controller input').addEventListener('change',
			CSC1840.handleColor, false);
			
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
		drawRoi: drawRoi,
		drawIris: drawIris,
		drawImage: drawImage,
		handleColor: handleColor,
		onScreenImage: onScreenImage
	};
}());

// bootstrap the application on window load
window.onload=function(){
	// run the application
	CSC1840.run();
};
