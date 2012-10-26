/**
 * Object detector utility
 *
 * Calculates features found in the Mat (image), and returns the coordinates of
 * them as an array.
 *
 */

var fs = require('fs'),
	path = require('path'),
	q = require('q'),
	cv = require('opencv-node');	// used for everything else opencv related

module.exports = function(){
	// Enable debug to see the various stages of the image process.
	this.DEBUG = false;
	
	// these will vary, scaled in function of eye.rect.width,
	// eg. the size of the uploaded image...
	this.otsuThreshold = 0;
	
	this.inputImage = null;
	this.eqImage = null;
	this.grayImage = null;
	this.filteredImage = null;

	this.ROI = {
		faces: null,
		eyes: null
	};
	this.haar = {
		face: path.resolve('./public/data/haar/faces/haarcascade_frontalface_default.xml'),
		eye: path.resolve('./public/data/haar/eyes/haarcascade_eye_tree_eyeglasses.xml')
	};
	this.cascade = null;
	
	
	/* PRIVATE METHODS */
	
	/**
	 * drawHistogram
	 *
	 * for debug purposes only - visualizes a histogram, with optional
	 * values to highlight, obviously on a headless server this is useless,if
	 * not harmful...
	 *
	 * @param {Object}	the histogram object to draw
	 * @param {int}	optional value to highlight
	 */
	 this.drawHistogram = function( histogram, highlight){
	 	var histImage = new cv.Mat( 200,256, cv.CV_8UC3, [255,255,255]);
	 	var maxVal = 0;
	 	for( val in histogram ){
	 		if( histogram[val] > maxVal ) maxVal = histogram[val];
	 	}
	 	
	 	var i = 1;
	 	for( i; i < 256; ++i )
		{
			cv.line( histImage,
				{ 	x:i,
					y:200
				},
				{	x:i,
					y:200-parseInt(histogram[i] / maxVal * 200)
				},
				[0, 0, 0],
				1, 8, 0
			);
		}
		if( typeof highlight === 'number' ){
			cv.line( histImage,
				{ 	x:highlight,
					y:200
				},
				{	x:highlight,
					y:0
				},
				[0, 0, 255],
				1, 8, 0
			);
		}
	 };
	 
	/**
	 * function calcHist
	 *
	 * calculates histogram for grayscale image
	 *
	 * @param {cv.Mat} input image
	 * @return {Object} array of the ocurrance of each value
	 */
	this.calcHist = function(input){
		process.send({info:'Calculating histogram'});
		var histData = [];

		// initializing with 0
		var el=0;
		for(el; el<256; ++el ){
			histData[el] = 0;
		}
		
		// calculating histogram for grayscale source
		var i=0;
		for(i; i<input.total; ++i){
			// int [0...255]
			var value = input[input.channels*i];
			if(typeof histData[value] !== 'number' ){
				histData[value] = 1;
			} else{
				histData[value]++;
			}
		}
		
		return histData;
	};
	
	/**
	 * function getOtsuThreshold
	 *
	 * ported java implementation to javascript
	 *
	 * @param {cv.Mat} the source image
	 * @return {int} the threshold number
	 *
	 * @see http://www.labbookpages.co.uk/software/imgProc/otsuThreshold.html
	 */
	this.getOtsuThreshold = function(histogram){
		process.send({info:'Calculating Otsu threshold of image'});
		var sum = 0.0;	// Number
		var totalPixels = 0;
		
		var t=0;
		for (t=0; t<256; ++t){
			sum += t * histogram[t];
			if( histogram[t] !== 0 ) totalPixels += histogram[t];
		}
		console.log('calculated histogram sum:'+sum);
		var sumB = 0.0;	//Number
		var wB = 0;		//int
		var wF = 0;		//int

		var varMax = 0.0;
		var threshold = 0.0;
		t = 0;
		for (t ; t<256 ; t++) {
		   wB += histogram[t];               // Weight Background, number
		   if (wB == 0) continue;
		   
		   wF = totalPixels - wB;			// Weight Foreground, number
		   if (wF == 0) break;
		   
		   sumB += (t * histogram[t]);

		   var mB = sumB / wB;				// Mean Background
		   var mF = (sum - sumB) / wF;		// Mean Foreground

		   // Calculate Between Class Variance
		   var varBetween = wB * wF * (mB - mF) * (mB - mF);

		   // Check if new maximum found
		   if (varBetween > varMax) {
			  varMax = varBetween;
			  threshold = t;
		   }
		}
		console.log('OTSU threshold: ' + threshold);
		return threshold;
	};
	
	/**
	 * function processImage
	 *
	 * @param {cv.Mat} the source image for processing
	 * @return
	 */
	 this.processImage = function(src){
		process.send({info:'Processing the image...'});
	 	
	 	this.inputImage = new cv.Mat(src.size, src.type);
	 	src.copyTo(this.inputImage);
	 	
	 	// grayscale version of the source
		this.grayImage = new cv.Mat(src.size, src.type);
		
		// equalized version of the source
		this.eqImage = new cv.Mat(src.size, src.type);
	 	
	 	// to be filtered later
	 	this.filteredImage = new cv.Mat(src.size, src.type);
	 	
		cv.cvtColor(src, this.grayImage, cv.CV_RGB2GRAY);
		cv.equalizeHist(this.grayImage, this.eqImage);
	 };
	 
	/**
	 * function detectFaces
	 *
	 * runs a simple CascadeClassifier with faces detection
	 *
	 * @param {String} the haarCascade to use for detection
	 * @return {Object} the detected faces
	 */
	this.detectFaces = function(haar){
		if (!this.cascade.load(haar)) {
		  console.log('Cascade load failed');
		}
		
		var faces = this.cascade.detectMultiScale(
			this.eqImage, 1.1, 3, 0, {	width: 20,
										height: 20	});
		
		console.log('faces found:' + faces.length);
		return faces;
	};

	/**
	 * function detectEyes
	 *
	 * runs a simple CascadeClassifier with faces detection
	 *
	 * @param {String} the haarCascade to use for detection
	 * @return {Object} the detected faces
	 */
	this.detectEyes = function(haar){
		process.send({info:'Detecting eyes...'});
		if (!this.cascade.load(haar)) {
		  console.log('Cascade load failed');
		}
		
		var eyes = this.cascade.detectMultiScale(this.eqImage, 1.1, 3, 0, {
		  width: 20,
		  height: 20
		});
		console.log('eyes found:' + eyes.length);
		process.send({info:(eyes.length+' eye(s) found.')});
		return eyes;
	}


	/* PUBLIC METHODS */
	
	this.init = function(){
		this.cascade = new cv.CascadeClassifier;
	}
	
	/**
	 * function Run
	 *
	 * triggers the detection phase, running a series of object detection and
	 * image manipulation sub-routines
	 *
	 * @param {Mat} the Matrix of the image to test
	 * @return {Object} an Object containing the results
	 */
	this.getROI = function(src){
		process.send({info:'Calculating ROIs'});
		// prepare image for detection (grayscale and equalized)
		this.processImage(src);
		
		// run face detection
		//this.ROI.faces = this.detectFaces(this.haar.face);
		this.ROI.faces = [];
		
		// run eyes detection		
		this.ROI.eyes = this.detectEyes(this.haar.eye); 
		
		return this.ROI;
	}
	
	/**
	 * function detectIris
	 *
	 * segmentation of iris from image
	 *
	 * @param {}
	 * @return {}
	 */
	 this.getIris = function(){
	 	if( this.ROI.eyes.length === 0 ){
	 		console.log('No eyes previously detected!')
	 		process.send({error:'No eyes previously detected!'});
	 		return;
	 	}
	 	
	 	process.send({info:'Segmenting the iris'});
	 	// store the results..
		var result = [];
		var i = 0;
		for (i; i < this.ROI.eyes.length; ++i){
			console.log('parsing eye:'+i+' of a total '+this.ROI.eyes.length);
			// create a region image of the eye ROI
			var eyeRegion = new cv.Mat(this.grayImage, this.ROI.eyes[i], cv.CV_8UC1);
			
			if( this.DEBUG ){
				cv.imshow("DEBUG1", eyeRegion);
				cv.waitKey();
			}
			
			/**
			 * DETECTION CONFIGURATION
			 *
			 * These are my 'best-till-now' values, based mainly on trial 
			 * and error.
			 * Based on some assumptions (min/max iris/ROI ratio and image size)
			 * 
			 * various qualities that influence the detect rate:
			 *
			 * image sharpness
			 * image contrast
			 * image resolution
			 * lightning conditions (UV illuminated eyes are best for pupils)
			 * noise...
			 *
			 * As the retina segmentation and biometric identity is a huge field
			 * obviously, this application is just a demo...
			 */
			var hough_circle_min_dist = 10;
			var hough_min_r;
			var hough_max_r;
			var hough_param2 = 25 + 0.5 * eyeRegion.cols;
			var edge_threshold = 7;
			var canny_high_threshold = edge_threshold*16;
			var filter_method = cv.CV_MEDIAN;
			var filter_size = 9;
			var otsuDelta = 0.2;
			/**
			 * Some-sort-of-adaptative set the optimal values deduced from the
			 * image size.
			 *
			 * TODO: implement more algorithms to get the best base image...
			 */
		 	
		 	/* set some control parameters for the tasks ahead,
			 * based on the ROI dimensions */
		 	
		 	// calculate filter_scale, for CV_MEDIAN it must be
		 	//	assert ((filter > 0) && (filter % 2 != 1))
			filter_size = parseInt(0.025 * eyeRegion.cols);
			if ( filter_size > 1 && filter_size % 2 !== 1 ){
				filter_size += 1;
			} else if(filter_size <= 1) {
				filter_size = 1;
				filter_method = cv.CV_GAUSSIAN;
			};
			
			// min distance between the circle candidates to be treated as
			// separate circles
		 	hough_min_dist = parseInt(0.06 * eyeRegion.cols);

		 	// desired min/max radius for the circle candidates
			hough_min_r = parseInt(eyeRegion.cols*0.13);
			hough_max_r = parseInt(eyeRegion.cols*0.25);
			
			/*******************************************************************
			 * Phase 1 - Image filters
			 *
			 * - grayscale
			 * - smooth
			 * - separating background/foreground based on OTSU's method
			 ******************************************************************/
			// converting to graayscale
////////////			cv.cvtColor(eyeRegion, eyeRegion, cv.CV_RGB2GRAY);
			
			// Smoothing
		 	cv.cvSmooth(
		 		eyeRegion,
		 		eyeRegion,
		 		filter_method,
		 		filter_size,
		 		filter_size );
		 	
			// calculate histogram for the eye ROI
			var histogram = this.calcHist(eyeRegion);
			
			// calculate OTSU threshold
			var otsuThreshold = this.getOtsuThreshold(histogram);
			//this.drawHistogram(histogram, otsuThreshold);
			
			// this image will hold the HALF-OTSU_TRESHOLD image
		 	var thresholdedImage = new cv.Mat(eyeRegion.size,cv.CV_8UC1);
		 	eyeRegion.copyTo(thresholdedImage);

			/*******************************************************************
			 * Phase 2:
			 *
			 * applying various filters to the image
			 *	- threshold:	separate foreground -pupil- (eyebrows!)
			 *					and background, based on OTSU's method
			 *	- smoothing:	apply a Median filter to descrease spikes
			 *	- *opening:		erode (extend) and dilate (contract) for closing
			 *					small details (eyebrows)
			 *	- (canny):		get the contours of the blobs
			 ******************************************************************/
		 	
			cv.equalizeHist(thresholdedImage, thresholdedImage);
			if( this.DEBUG ){
				cv.imshow("DEBUG1", thresholdedImage);
				cv.waitKey();
			}
//			var lO = otsuThreshold * 0.55;
//			var hO = otsuThreshold * 1.65;
			var lO = otsuThreshold * (1-otsuDelta);
			var hO = otsuThreshold * (1+otsuDelta);

			cv.inRange(thresholdedImage, [lO,lO,lO], [hO,hO,hO], thresholdedImage);
			if( this.DEBUG ){
				cv.imshow("DEBUG1", thresholdedImage);
				cv.waitKey();
			}

			// thresholding the image
		 	cv.threshold(eyeRegion,				// source
				thresholdedImage,				// destination
				parseInt(otsuThreshold*0.7),	// threshold
				255,							// max value
				cv.THRESH_BINARY_INV);			// threshold method

			/*
			 * "Opening" (eroding+dilating)
		 	 * reducing features for HoughCircles detection
		 	 *
		 	 * note: 'till today my pull-request to include the 'erode' filter
		 	 * is not accepted, till it can be downloaded by npm, turn it off
		 	 */
		 	var openImage = new cv.Mat(eyeRegion.size, cv.CV_8UC1);
		 	/*
		 	cv.erode(thresholdedImage,	// source
		 		openImage,				// destination
		 		new cv.Mat(),			// mask
		 		{x:-1,y:-1},
				2 );					// iterations
				
		 	cv.dilate(openImage,		// source
		 		openImage,				// destination
		 		new cv.Mat(),			// mask
		 		{x:-1,y:-1},
				2 );					// iterations
			*/
			
			/**
			 * DEBUG ONLY
		 	 * visualizing 'posible' HoughCircles intern canny
		 	 * threshold high/low mimic HoughCircles internals
		 	 */
		 	var canny = new cv.Mat(thresholdedImage);
		 	cv.Canny( 	canny,
		 				canny,
		 				parseInt(canny_high_threshold*0.5),	// threshold high 
		 				canny_high_threshold,				// threshold low
				 		3,
				 		true
		 	);
			if( this.DEBUG ){
				cv.imshow("DEBUG1", canny);
				cv.waitKey();
			}
		 	/*******************************************************************
		 	 * Phase 3
		 	 *
		 	 * Isolate the pupil from the image using HoughCircles algorithm.
		 	 * The technical papers on iris/pupil detections recommend UV lit
		 	 * eye images, due the fact that the (TODO: cornea) shows less
		 	 * contrast in those conditions (needed for a near-perfect iris
		 	 * detection possible).
		 	 *
		 	 ******************************************************************/
		 	/* HoughCircles(Mat& image,
		 		int method,
		 		double dp,
		 		double minDist,
		 		double param1=100,
		 		double param2=100,
		 		int minRadius=0,
		 		int maxRadius=0)*/
			var circles = cv.HoughCircles(
				canny,							// source
				cv.CV_HOUGH_GRADIENT,			// only method in opencv
				10,								// scale factor
				hough_min_dist,					// min distance between circles
				canny_high_threshold,			// canny high-threshold
				hough_param2,					//
				hough_min_r,					// min radius
				hough_max_r						// max radius
			);
			
			
			
			console.log('circles found:'+circles.length);
			process.send({info:('Hough found '+circles.length+' circle(s)')});
			if ( circles.length == 1 ){
				result.push( circles[0] );
			}else if( circles.length > 1 ){
				// treat result the circle more close to the center of ROI
				var imgCenterY = parseInt(eyeRegion.rows*0.5);
				var imgCenterX = parseInt(eyeRegion.cols*0.5);
				var imgCenter = { x: imgCenterX, y:imgCenterY };
				var candidates = circles.slice(0, circles.length > 25 ? 25 : circles.length);
				console.log(candidates);
				var iris = { index: 0 };
				var j = 0;
				for( j; j < candidates.length; ++j){
					
					var cand = candidates[j];
					var dist = this.lineDistance( imgCenter,
						{ x:cand[0], y:cand[1] });
					console.log('candidate '+j+' of '+candidates.length+' dist:'+dist);
					
					if( !iris.dist ){
						iris.dist = dist;
						console.log(j + ': ' + iris.dist);
					}else if( iris.dist > dist ){
						iris.index = j;
						iris.dist = dist;
						console.log(j + ': ' + iris.dist);
					}
				}
				result.push( candidates[ iris.index ] );
			}else{
			}
		}
		console.log('final result: '+ result.length);
		return result;
	 }
	
	/**
	 * Calculate distance between two points
	 * Helper
	 *
	 * @param {object}	x1,y1
	 * @param {object}	x2,y2
	 * @return {number}
	 */
	this.lineDistance = function( point1, point2 ){
		var xs = 0;
		var ys = 0;

		xs = point2.x - point1.x;
		xs = xs * xs;

		ys = point2.y - point1.y;
		ys = ys * ys;

		return Math.sqrt( xs + ys );
	};
	
	/**
	 * frees up resources, typically called when finished it's job and
	 * the ROI rectangles are ready.
	 *
	 * @return
	 */
	this.dispose = function(){
		cv.discardMats(this.input);
		this.input = null;
	};
	
	// call constructor
	this.init();
}
