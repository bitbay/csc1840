/**
 * Cloudspokes challenge #1840 - front-end application (plugins)
 * 
 * This file contains helpers, managers, utilities used in the application.
 *
 *	- ServerApi
 *	- Pusherpipe (not the real-deal! just one-way, server sent events...)
 *	- ViewManager
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
		errors: {}
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
				ViewManager.eyesROI = data.roi.eyes;
				//ViewManager.drawRoi();
			}
			if( data.iris ){
				ViewManager.irises = data.iris;
				ViewManager.setState( 'EDITING_STATE' );
			}
		});
		
		/* Pusher.com debug messages */
		
		this.pusher.connection.bind('connecting', function() {
			Logger.log('Connecting to Pusher...', 'pusher');
		});

		this.pusher.connection.bind('connected', function() {
			Logger.log('Connected to Pusher!', 'pusher');
		});

		this.pusher.connection.bind('failed', function() {
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
 * ViewManager 
 *
 * Manager for the canvases, with simple state the app is in.
 * (From DAO to Class)
 *
 */
var ViewManager = (function(){
	var errors = {
		NO_STATE : 'The requested state is INVALID.'
	};
	var state = 'INIT_STATE';
	var imageURL = '';
	var eyesROI = [];
	var irises = [];
	var pupils = [];
	var actualScale;
	var originalImageRect = {};
	var filters = {
		hue: 0,			// 0-360deg
		grayscale: 0,	// 0-1
		sepia: 0,		// 0-1
		saturate: 1,	// 0-1
		brightness: 0,	// 0-1
		contrast: 1,	// 0-1
		invert: 0
	};
	
	/**
	 * updates the reference in this class with the new values recieved
	 *
	 * @param {string} the filter changed.
	 * @param {number} the new filter value
	 */
	var setFilter = function( filter, value ){
		filters[filter] = value;
		updateStyle();
	};
	
	/**
	 * updates the CSS applied to the upper layer...
	 *
	 */
	var updateStyle = function(){
		var style = '-webkit-filter: hue-rotate(' + filters.hue + 'deg) ' +
									 'grayscale(' + filters.grayscale + ') ' +
									 'sepia(' + filters.sepia + ') ' +
									 'saturate(' + filters.saturate + ') ' +
									 'brightness(' + filters.brightness + ') ' +
									 'contrast(' + filters.contrast + ') ' +
									 'invert(' + filters.invert + ') ';
		
		document.querySelector('#layer0').setAttribute('style', style);
	};
	
	/* calculate 'letterbox' format to fit-scale the image in the 'stage'
	 * container
	 *
	 * @param {object}	width/height of the 'outer' container - bounds
	 *					(containing the canvas)
	 * @param {object}	optional object (img || {}) with width/height fields,
	 * 					the 'inner' component to resize
	 */
	var correctedTransform = function(rect, image){
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
	
	
	// helper utility
	// @see: http://www.quirksmode.org/dom/getstyles.html
	function getStyle(el,styleProp)
	{
		return document.defaultView.getComputedStyle(el,null).
			getPropertyValue(styleProp);
	}
	
	/**
	 * clearCanvas
	 *
	 * clears a canvas before drawing letting the parent flex into position/dim
	 *
	 * @param {canvasElement} canvaselement to reset
	 */
	var clearCanvas = function( canvas ){
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
	};
	
	
	/**
	 * drawImage
	 *
	 * redraws the whole image to fit inside the -webkit-flex container, and let
	 * it flow...
	 *
	 * @params {domelement} a target canvas where the fills happen
	 */
	var drawImage = function (canvas){
		if( ViewManager.imageURL == '' ) return false;
		var img = new Image();
		
		img.onload = function(){
			//var grandParent = document.querySelector('body>section');
			var grandParent = canvas.parentNode.parentNode;
			var padding = getStyle( grandParent, 'padding');
			padding = parseInt(padding);
			var rect = { width:grandParent.clientWidth-padding*2,
						 height: grandParent.clientHeight-padding*2 };
						 
			// calculates 'letterbox', fit into container sizes
			var cT = ViewManager.correctedTransform(rect, img);
			
			// update canvas size
			canvas.width = cT.width;
			canvas.height = cT.height;
			
			var ctx = canvas.getContext('2d');
			ctx.save();
			
			// draw the image
			ctx.drawImage(	img,
							0, 0,
							cT.width, cT.height);
			ctx.restore();
			
			// this patch is necessary to center the 'stage' div, with absolute
			// positioned overlays inside...
			var calcTop = (grandParent.clientHeight-canvas.height) * 0.5 - padding;
			var calcLeft = (canvas.width)*0.5;
			canvas.parentNode.setAttribute('style', 'top:'+ calcTop +
											'px; left:-'+ calcLeft +'px;');
		};
		// kick-off the load (probably from cache by now)
		img.src = ViewManager.imageURL;
	};
	
	/**
	 * drawRoi
	 *
	 * debug feature, that displays the detected Regions of interest (eyes)
	 * not used.
	 */
	var drawRoi = function (){
		if( this.state == 'EDITING_STATE' ) return;
		// if drawing the iris too, not the debug regions...
		if( ViewManager.irises.length !== 0 ) return;
		
		// getting scale modifier
		var sc = ViewManager.actualScale;
		var canvas = document.querySelector('canvas');
		var ctx = canvas.getContext('2d');
		ctx.save();
		ctx.strokeStyle = "#F9F9F9";
		ctx.lineWidth = 1;
		
		var i;
		for(i; i<ViewManager.eyesROI; ++i) {
			ctx.strokeRect(	ViewManager.eyesROI[i].x*sc,
							ViewManager.eyesROI[i].y*sc,
							ViewManager.eyesROI[i].width*sc,
							ViewManager.eyesROI[i].height*sc );
		}
		ctx.restore();		
	};
	
	/**
	 * drawMask
	 *
	 * draws the colored layer masked with the iris circles
	 *
	 * @params {domelement} a target canvas where the fills happen
	 */
	 var drawMask = function(canvas){
	 	if( ViewManager.imageURL == '' ) return false;
	 	
		// getting canvas-scale modifier
		var sc = ViewManager.actualScale;
		var img = new Image();
		
		img.onload = function(){
			// getting the padding for the container
			var padding = getStyle( canvas.parentNode.parentNode, 'padding');
			padding = parseInt(padding);
			
			//  calculating the real container dimensions
			var rect = { width:canvas.parentNode.parentNode.clientWidth-padding*2,
						 height: canvas.parentNode.clientHeight };
			var cT = ViewManager.correctedTransform(rect, img);
			
			// setting canvas dimension
			canvas.width = cT.width;
			canvas.height = cT.height;
			
			// drawing the image inside the resized canvas
			var ctx = canvas.getContext('2d');
			ctx.save();
			ctx.beginPath();
			ctx.drawImage(	img,
							0, 0,
							cT.width, cT.height);
		    ctx.closePath();
		    
		    // setting the masking operation...
		    // the next thing that goes inside the context will cut this out.
		    // for a complete list 
		    // @see: https://developer.mozilla.org/en-US/docs/Canvas_tutorial/Compositing
		    ctx.globalCompositeOperation = 'destination-out';
		    
		    // now draw the mask...
		    var i = 0;
		    for(i; i<ViewManager.irises.length; ++i){
				if ( ViewManager.irises[i].length < 1 ) return;
				
				// regionOffset
				var rO = { 	x: ViewManager.eyesROI[i].x*sc,
							y: ViewManager.eyesROI[i].y*sc };
				
				// a not-so-hard circle border with gradients
		    	var radgrad = ctx.createRadialGradient(
		    		parseInt(ViewManager.irises[i][0]*sc+rO.x),
		    		parseInt(ViewManager.irises[i][1]*sc+rO.y),
		    		parseInt(ViewManager.irises[i][2]*sc*0.5),
		    		parseInt(ViewManager.irises[i][0]*sc+rO.x),
		    		parseInt(ViewManager.irises[i][1]*sc+rO.y),
		    		parseInt(ViewManager.irises[i][2]*sc));
		    		
		    	radgrad.addColorStop(0, 'rgba(0,0,0,1)');
				radgrad.addColorStop(0.8, 'rgba(0,0,0,1)');
				radgrad.addColorStop(0.95, 'rgba(0,0,0,0.9)');
				radgrad.addColorStop(1, 'rgba(0,0,0,0)');
				
				ctx.fillStyle = radgrad;
				
				// draw the iris
				ctx.beginPath();
				ctx.arc(parseInt(ViewManager.irises[i][0]*sc+rO.x),
						parseInt(ViewManager.irises[i][1]*sc+rO.y),
						parseInt(ViewManager.irises[i][2]*sc),
						0,Math.PI*2,false);
				ctx.fill();
				
				ctx.closePath();
			}
			ctx.restore();
		};
		
		img.src = ViewManager.imageURL;
	 };
	 
	/**
	 * The application can be in three distint states.
	 *
	 * INIT_STATE: startup. No images on the screen, just the nav icons.
	 * LOADING_STATE: once the user clicks a thumbnail the application steps in
	 * 	this state. Just the (colored) image is visible.
	 * EDITING_STATE: the iris data is loaded, and the user can change the
	 *	filters
	 * 
	 * @param {string} the state to switch to.
	 */
	var setState = function ( nextState ){
		switch (nextState){
			case 'LOADING_STATE' :
			{	
				this.state = 'LOADING_STATE';
		 		// reset previous results
		 		ViewManager.eyesROI = [];
				ViewManager.irises = [];
				
				// trigger calculus on server
				ServerApi.calculateIris(this.imageURL);
				
				// put the view in LOADING_STATE...
				var canvas1 = document.querySelector('#layer1');
		 		clearCanvas(document.querySelector('#layer0'));
		 		clearCanvas(canvas1);
		 		drawImage(canvas1);

		 		break;
			}
			case 'EDITING_STATE' :
			{
				this.state = 'EDITING_STATE';

				// move the image to the filtered layer0
				// draw the overlayed colored/masked layer
				var canvas0 = document.querySelector('#layer0');
				var canvas1 = document.querySelector('#layer1');
		 		clearCanvas(canvas0);
		 		clearCanvas(canvas1);
				drawImage(canvas0);
				drawMask(canvas1);
				break;
			}
			default:
				throw new Error( this.errors.NO_STATE );
				break;
		}
	};
	
	/* Public methods exposed for Logger */
	return {
		setState: setState,
		correctedTransform: correctedTransform,
		errors: errors,
		imageURL: imageURL,
		clearCanvas: clearCanvas,
		drawImage: drawImage,
		drawRoi: drawRoi,
		drawMask: drawMask,
		setFilter: setFilter
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

		// messages are colored with CSS based on sender.
		logs[ UTCstring ] = {
			'sender': sender,
			'message': msg
		};
		
		// append the message to the aside (msg container)
		var el = document.querySelector('#messages');
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
			case ViewManager.errors.NO_STATE:
				console.log("ViewManager [error]: " + error);
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
