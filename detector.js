/**
 * Object detector utility
 *
 * Calculates features found in the Mat (image), and returns the coordinates of
 * them as an array.
 *
 * results = {
 *		faces: [
 *			Rect,	// face 1
 *			Rect,	// face 2
 *			...		// face n
 *		],
 *		eyes:[
 *			[
 *				// face 1
 *				Rect,	// eye 1
 *				Rect	// eye 2
 *			],
 *			[
 *				// face 2
 *				Rect,	// eye 1
 *				Rect	// eye 2
 *			]
 *		] 
 * }
 */

var fs = require('fs'),
	walk = require('walk'),
	cv = require('opencv-node');	// used for everything else opencv related

module.exports = function(){
	// Enable debug to see the various stages of the image process.
	this.DEBUG = true;
	
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
		face: './data/haar/faces/haarcascade_frontalface_default.xml',
		eye: './data/haar/eyes/haarcascade_eye_tree_eyeglasses.xml'
		//eye: './data/haar/eyes/haarcascade_eye.xml'
		//eye: './data/haar/eyes/haarcascade_lefteye_2splits.xml'
	}
	this.cascade = null;
	
	
	/* PRIVATE METHODS */
	
	/**
	 * Utility function getPixelRGB
	 *
	 * helper to get RGB value from a coordinate Point2D(x,y) of a cv.Mat
	 *
	 * TODO: support for less than 3 channel pixels...
	 *
	 * @param {cv.Point2D}	pixel coordinate
	 * @return {Array}	[r,g,b] values
	 */
	this.pixelAt = function(src,x,y){
		// cv.Mat.data in bgr format...
		return [ src[src.channels*src.cols*x + src.channels*y + 2],
				src[src.channels*src.cols*x + src.channels*y + 1],
				src[src.channels*src.cols*x + src.channels*y + 0] ];
	}
	
	/**
	 * drawHistogram
	 *
	 * for debug purposes only - visualizes a histogram, with optional
	 * values to highlight
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
		
		if( this.DEBUG ){
			cv.imshow("HISTOGRAM", histImage);
		}
	 }
	/**
	 * function calcHist
	 *
	 * calculates histogram for grayscale image
	 *
	 * @param {cv.Mat} input image
	 * @return {Object} array of the ocurrance of each value
	 */
	this.calcHist = function(input){
		console.log('calculating histogram');
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
	}
	
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
		var sum = 0.0;	// Number
		var totalPixels = 0;
		
		var t=0;
		for (t=0; t<256; ++t){
			sum += t * histogram[t];
			if( histogram[t] !== 0 ) totalPixels += histogram[t];
		}
		console.log('calculated sum:'+sum);
		var sumB = 0.0;	//Number
		var wB = 0;		//int
		var wF = 0;		//int

		var varMax = 0.0;
		var threshold = 0.0;
		t = 0;
		for (t ; t<256 ; t++) {
		   wB += histogram[t];               // Weight Background, number
		   if (wB == 0) continue;
		   
		   wF = totalPixels - wB;                 // Weight Foreground, number
		   if (wF == 0) break;
		   
		   sumB += (t * histogram[t]);

		   var mB = sumB / wB;            // Mean Background
		   var mF = (sum - sumB) / wF;    // Mean Foreground

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
	}
	/**
	 * function processImage
	 *
	 * @param {cv.Mat} the source image for processing
	 * @return
	 */
	 this.processImage = function(src){
	 	this.inputImage = new cv.Mat(src.size, src.type);
	 	src.copyTo(this.inputImage);
console.log('pixelat[0,0]:'+ cv.mGet(src,1,1));
console.log('pixelat[0,0]:'+ cv.mGet(src,1,2));
console.log('pixelat[0,0]:'+ cv.mGet(src,2,3));
	 	// grayscale version of the source
		this.grayImage = new cv.Mat(src.size, src.type);
		// equalized version of the source
		this.eqImage = new cv.Mat(src.size, src.type);
	 	this.filteredImage = new cv.Mat(src.size, src.type);
	 	
		cv.cvtColor(src, this.grayImage, cv.CV_RGB2GRAY);
		cv.equalizeHist(this.grayImage, this.eqImage);
		
		// debugging

		cv.imwrite('./data/output/eqImage.jpg', this.eqImage);
		//cv.imwrite('./data/output/filteredImage.jpg', this.filteredImage);
		//console.log('0' + this.inputImage[0]);
		
/*		console.log(this.inputImage);
		console.log('src.channels:');
		console.log(this.inputImage.channels );
		console.log('src.cols:');
		console.log(this.inputImage.cols );
		for( prop in this.inputImage ){
			console.log(this.inputImage[prop]);
		}
		*/
	 }
	 
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
		/*
		var faces = this.cascade.detectMultiScale(
			this.eqImage,
            1.1, 2, 0
            |cv.CV_HAAR_FIND_BIGGEST_OBJECT
            |cv.CV_HAAR_SCALE_IMAGE
            ,
            { width: 30,
            	height: 30} );
        */    
		var faces = this.cascade.detectMultiScale(
			this.eqImage,
			1.1,
			3,
			0,
			{
				width: 20,
				height: 20
			});
		
		console.log('faces found:' + faces.length);
		return faces;
	}

	/**
	 * function detectEyes
	 *
	 * runs a simple CascadeClassifier with faces detection
	 *
	 * @param {String} the haarCascade to use for detection
	 * @return {Object} the detected faces
	 */
	this.detectEyes = function(haar){
		if (!this.cascade.load(haar)) {
		  console.log('Cascade load failed');
		}
		/*
		var eyes = this.cascade.detectMultiScale(
			this.grayImage,
            1.1, 2, 0
            |cv.CV_HAAR_FIND_BIGGEST_OBJECT
            |cv.CV_HAAR_SCALE_IMAGE
            ,
            { width: 30,
            	height: 30} );
		/*/
		var eyes = this.cascade.detectMultiScale(this.eqImage, 1.1, 3, 0, {
		  width: 20,
		  height: 20
		});
		console.log('eyes found:' + eyes.length);
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
		// prepare image for detection
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
	 		console.log('no eyes previously detected!')
	 		return;
	 	}

		var i = 0;
		for (i; i < this.ROI.eyes.length; ++i){
			// create a region image of the eye ROI
			var eyeRegion = new cv.Mat(this.inputImage, this.ROI.eyes[i], cv.CV_8UC1);
			
			var hough_circle_min_dist = 10;
			var hough_min_r;
			var hough_max_r;
			var edge_threshold = 5;
			var canny_high_threshold = edge_threshold*2;
			var filter_method = cv.CV_MEDIAN;
			var filter_size = 9;
			
		 	// calculate filter_scale, for CV_MEDIAN it must be
		 	//	assert ((filter > 0) && (filter % 2 != 1))
			filter_size = parseInt(0.025 * eyeRegion.cols);
			console.log('primary filter size:' + this.filter_size);
			if ( filter_size > 1 && filter_size % 2 !== 1 ){
				filter_size += 1;
			} else if(filter_size <= 1) {
				filter_size = 1;
				filter_method = cv.CV_GAUSSIAN;
			};
			
			console.log('calculated filter:'+ filter_size + ', for width:'+eyeRegion.cols);

			/* set some control parameters for the tasks ahead,
			 * based on the ROI dimensions */

			// min distance between the circle candidates to be treated as
			// separate circles
		 	hough_min_dist = parseInt(0.05 * eyeRegion.cols);

		 	// desired min/max radius for the circle candidates
			hough_min_r = parseInt(eyeRegion.cols*0.15);
			hough_max_r = parseInt(eyeRegion.cols*0.3);
			
			/*******************************************************************
			 *******************************************************************
			 * Phase 1
			 *
			 * Preparing the image for segmentation, and make some preliminatory
			 * decisions about geometry size...
			 */
			// converting to graayscale
			cv.cvtColor(eyeRegion, eyeRegion, cv.CV_RGB2GRAY);
			
			// Smoothing
		 	cv.cvSmooth(
		 		eyeRegion,
		 		eyeRegion,
		 		filter_method,
		 		filter_size,
		 		filter_size );
		 	// DEBUG
		 	if( this.DEBUG ){
			 	cv.imshow("DEBUG", eyeRegion);
			 	cv.waitKey();
			}
			
			// calculate histogram for the eye ROI
			var histogram = this.calcHist(eyeRegion);
			
			// calculate OTSU threshold
			var otsuThreshold = this.getOtsuThreshold(histogram);
			this.drawHistogram(histogram, otsuThreshold);
			
			// this image will hold the HALF-OTSU_TRESHOLD image
		 	var thresholdedImage = new cv.Mat(eyeRegion.size,cv.CV_8UC1);
		 	eyeRegion.copyTo(thresholdedImage);
		 	
		 	// DEBUG
		 	if(this.DEBUG ) {
		 		cv.imshow("DEBUG", thresholdedImage);
			 	cv.waitKey();
			}
			
			/*******************************************************************
			 *******************************************************************
			 * Phase 2:
			 *
			 * applying various filters to the image
			 *	- threshold:	separate foreground -pupil- (eyebrows!)
			 *					and background, based on OTSU's method
			 *	- smoothing:	apply a Median filter to descrease spikes
			 *	- "opening":	erode (extend) and dilate (contract) for closing
			 *					small details (eyebrows)
			 *	- (canny):		get the contours of the blobs
			 */
		 	
		 	//cv.equalizeHist(thresholdedImage, thresholdedImage);
		 	
		 	// DEBUG
		 	if( this.DEBUG ){
			 	cv.imshow("DEBUG", thresholdedImage);
			 	cv.waitKey();
			}
			
		 	cv.imwrite('./data/output/eyeROI_'+i+'.jpg', eyeRegion);
		 	cv.threshold(eyeRegion,				// source
				thresholdedImage,				// destination
				parseInt(otsuThreshold*0.70),	// threshold
				255,							// max value
				cv.THRESH_BINARY_INV);			// threshold method
			
			// DEBUG
		 	cv.imwrite('./data/output/threshold_calc_'+ i +'.jpg', thresholdedImage);
			if( this.DEBUG ){
			 	cv.imshow("DEBUG", thresholdedImage);
			 	cv.waitKey();
			}
		 	/* now done before calculating histogram */
		 	/*
		 	// Smoothing
		 	cv.cvSmooth(
		 		thresholdedImage,
		 		thresholdedImage,
		 		this.filter_method,
		 		this.filter_size,
		 		this.filter_size );
		 	// DEBUG
		 	if( this.DEBUG ){
			 	cv.imshow("DEBUG", thresholdedImage);
			 	cv.waitKey();
			}
			*/
		 	// "Opening" (eroding+dilating)
		 	// reducing features for HoughCircles detection
		 	var openImage = new cv.Mat(eyeRegion.size, cv.CV_8UC1);
		 	
		 	cv.erode(thresholdedImage,	// source
		 		openImage,				// destination
		 		new cv.Mat(),			// mask
		 		{x:-1,y:-1},
				2 );					// iterations
				
		 	cv.imwrite('./data/output/eroded.jpg', openImage);
			if( this.DEBUG ){
			 	cv.imshow("DEBUG1", openImage);
			 	cv.waitKey();
			}
		 	cv.dilate(openImage,		// source
		 		openImage,				// destination
		 		new cv.Mat(),			// mask
		 		{x:-1,y:-1},
				2 );					// iterations
				
		 	cv.imwrite('./data/output/dilated.jpg', openImage);
			if( this.DEBUG ){
			 	cv.imshow("DEBUG1", openImage);
			 	cv.waitKey();
			}
		 	
		 	// visualizing 'posible' HoughCircles intern canny
		 	// threshold high/low mimic HoughCircles internals
		 	var canny = new cv.Mat(openImage);
		 	cv.Canny( 	canny,
		 				canny,
		 				parseInt(canny_high_threshold*0.5),	// threshold high 
		 				canny_high_threshold,				// threshold low
				 		3,
				 		true
		 	);
			//cv.imwrite('./data/output/canny.jpg', canny);
			if( this.DEBUG ){
			 	cv.imshow("DEBUG-CANNY", canny);
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
		 	 */
		 	/* HoughCircles(Mat& image,
		 		int method,
		 		double dp,
		 		double minDist,
		 		double param1=100,
		 		double param2=100,
		 		int minRadius=0,
		 		int maxRadius=0)*/
			var circles = cv.HoughCircles(
				openImage,						// source
				cv.CV_HOUGH_GRADIENT,			// only method in opencv
				1.5,							// scale factor
				hough_min_dist,					// min distance between circles
				canny_high_threshold,			// canny high-threshold
				5,								//
				hough_min_r,					// min radius
				hough_max_r						// max radius
			);

			console.log('circles found:'+circles.length);
			var inputRegion = new cv.Mat(this.inputImage, this.ROI.eyes[i]);
			var debugImage = inputRegion;
			if( debugImage.type === cv.CV_8UC1)
				cv.cvtColor(debugImage, debugImage, cv.CV_GRAY2RGB);
			if( circles.length > 0 ){
				var j = 0;
				//for(j; j<circles.length; ++j){
				for(j; j<5; ++j){
					// scalars are given in BGR format...
					var color;
					switch(j){
						case 0 :
							color = [0,0,255];
							break;
						case 1 :
							color = [0,255,0];
							break;
						case 2 :
							color = [255,0,0];
							break;
						default :
							color = [0,128,128];
							break;
					}
					cv.circle(
						debugImage,
						//this.inputImage,
						//{ x: parseInt(circles[j][0])+this.ROI.eyes[i].x, y: parseInt(circles[j][1])+this.ROI.eyes[i].y},
						{ x: parseInt(circles[j][0]), y: parseInt(circles[j][1])},
						parseInt(circles[j][2]),
						color,
						1,
						8);
					
				}
				//cv.imwrite('./data/output/houghCircles.jpg', this.inputImage);
				cv.imwrite('./data/output/houghcircles_'+i+'.jpg', debugImage);
				if( this.DEBUG ){
				 	cv.imshow("DEBUG1", debugImage);
				 	cv.waitKey();
				}
			}
		 	
		 	var center = parseInt(eyeRegion.cols*0.5);
		 	cv.line( debugImage,
				{ 	x:hough_min_r+center,
					y:eyeRegion.rows
				},
				{	x:hough_min_r+center,
					y:0
				},
				[0, 255, 255],
				1, 8, 0
			);
		 	cv.line( debugImage,
				{ 	x:center-hough_min_r,
					y:eyeRegion.rows
				},
				{	x:center-hough_min_r,
					y:0
				},
				[0, 255, 255],
				1, 8, 0
			);
			
			// debug max diameter
			cv.line( debugImage,
				{ 	x:hough_max_r+center,
					y:eyeRegion.rows
				},
				{	x:hough_max_r+center,
					y:0
				},
				[255, 255, 0],
				1, 8, 0
			);
		 	cv.line( debugImage,
				{ 	x:center-hough_max_r,
					y:eyeRegion.rows
				},
				{	x:center-hough_max_r,
					y:0
				},
				[255, 255, 0],
				1, 8, 0
			);
		 	if( this.DEBUG ){
			 	cv.imshow("DEBUG1", debugImage);
			 	cv.waitKey();
			}
		 	
		 	
		 	
		 	/*
		 	// filter the image...
			cv.cvSmooth(this.eqImage, this.eqImage, this.filter_method, this.filter_size, this.filter_size );
		 	var grayImage = new cv.Mat(region.size,region.type);
		 	var thresholdedImage = new cv.Mat(region.size,region.type);
		 	
			cv.cvtColor(region, grayImage, cv.CV_RGB2GRAY);
			cv.imshow("before", grayImage);
			cv.waitKey();
			var grayImage = new cv.Mat(region.size,region.type);
			
		 	cv.threshold(region,
				region,
				0,
				60,
				cv.THRESH_BINARY);
		 	cv.imwrite('./data/output/threshold_calc.jpg', thresholdedImage);
		 	
		 	cv.imshow("before", thresholdedImage);
			cv.waitKey();
			*/
			/**
			 * threshold(const Mat& src,
			 *		Mat& dst,
			 		double thresh,
			 		double maxVal,
			 		int thresholdType)
			 */
			 
			/*/////////////
			var grayFiltered = new cv.Mat(this.eqImage.size, this.eqImage.type);
			this.eqImage.copyTo(grayFiltered);
			//cv.cvtColor(grayFiltered, grayFiltered, cv.CV_RGB2GRAY);
			var croppedGray = new cv.Mat(grayFiltered, this.ROI.eyes[i]);
			var thresholdedImage = new cv.Mat(croppedGray.size,croppedGray.type);
			*/
			
			/*cv.threshold(croppedGray,
				thresholdedImage,
				250,
				255,
				cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
		 	cv.imwrite('./data/output/threshold.jpg', thresholdedImage);
		 	cv.imwrite('./data/output/threshold_cropped.jpg', croppedGray);*/
		 	//var thresholdedImage = new cv.Mat(croppedGray.size,croppedGray.type);
			
			/*/////////////
			cv.threshold(croppedGray,
				thresholdedImage,
				parseInt(this.otsuThreshold),
				255,
				cv.THRESH_BINARY_INV);
		 	cv.imwrite('./data/output/threshold_calc.jpg', thresholdedImage);
		 	var erodedMask = new cv.Mat(croppedGray.size,croppedGray.type);
		 	cv.erode(thresholdedImage,
		 		erodedMask,
		 		new cv.Mat(),
		 		{x:-1,y:-1},
				2
		 		);
		 	cv.imwrite('./data/output/eroded.jpg', erodedMask);
		 	*/
		 	
		 	/*
		 	var edges = new cv.Mat(croppedGray.size,croppedGray.type);
			cv.Canny(erodedMask,
				edges,
				this.edge_threshold,
				this.edge_threshold * 3);
			cv.imwrite('./data/output/canny_edges.jpg', edges);
			cv.imwrite('./data/output/canny_eroded.jpg', erodedMask);
			*/
			/*
			var circles = cv.HoughCircles(canny,
				cv.CV_HOUGH_GRADIENT,	//method
				1,	// dp
				region.height, // minDist
				30,	// param1
				10,	// param2
				10,
				80);
			*/
			/* uhiris method
			var circles = cv.HoughCircles(
				edges,
				cv.CV_HOUGH_GRADIENT,
				1,
				hough_circle_min_distance,
				this.edge_threshold*2,
				10,
				1,
				parseInt(edges.rows*0.3)
			);
			*/
			
			/*/////////////
			var circles = cv.HoughCircles(
				thresholdedImage,
				cv.CV_HOUGH_GRADIENT,
				1,
				this.hough_circle_min_distance, //hough_circle_min_distance,
				parseInt(this.edge_threshold*0.5),	//cv.canny( this, this*0.5)
				10,
				1,	// minRadius
				parseInt(croppedGray.width * 0.5)//parseInt(croppedGray.rows*0.3) // maxRadius
			);
			*/
		 	/* Canny(const Mat& image,
		 		Mat& edges,
		 		double threshold1,
		 		double threshold2,
		 		int apertureSize=3,
		 		bool L2gradient=false)
		 	*/
		 	
		 	/*/////////////
		 	var canny2 = new cv.Mat(thresholdedImage);
			//cv.cvtColor(canny2, canny2, cv.CV_RGB2GRAY);
		 	cv.Canny( canny2,
		 		canny2,
		 		parseInt(this.edge_threshold*0.5),
		 		this.edge_threshold,
		 		3,
		 		true);
			//cv.imwrite('./data/output/canny.jpg', canny);
			*/
		
			/* dilate(const Mat& src,
				Mat& dst,
				const Mat& element,
				Point anchor=Point(-1, -1),
				int iterations=1,
				int borderType=cv::BORDER_CONSTANT,
				const Scalar& borderValue=cv::morphologyDefaultBorderValue())
				);*/
			/*var dilate = new cv.Mat(canny, canny.type);
			cv.dilate(canny,
				dilate,
				new cv.Mat(),
				{x:-1,y:-1},
				2
				);
			cv.imwrite('./data/output/dilate.jpg', dilate);*/
		 	//Detect the circles in the image
		 	/* HoughCircles(Mat& image,
		 		int method,
		 		double dp,
		 		double minDist,
		 		double param1=100,
		 		double param2=100,
		 		int minRadius=0,
		 		int maxRadius=0)*/
		 	/*
			var circles = cv.HoughCircles(canny,
				cv.CV_HOUGH_GRADIENT,	//method
				1,	// dp
				region.height, // minDist
				30,	// param1
				10,	// param2
				10,
				80);
			*/
			
			/*/////////////
			console.log('circles found:'+circles.length);
			if( circles.length > 0 ){
				var j = 0;
				for(j; j<circles.length; ++j){
					//cv::circle(*img, center, radius, color, thickness, lineType, shift);
					//circle(Mat& img, Point center, int radius, const Scalar& color, int thickness=1, int lineType=8, int shift=0)
					cv.circle(this.inputImage,
						{ x: parseInt(circles[j][0])+this.ROI.eyes[i].x, y: parseInt(circles[j][1])+this.ROI.eyes[i].y},
						//{ x: parseInt(circles[i][0]), y: parseInt(circles[i][1])},
						parseInt(circles[j][2]),
						[0,255,0],
						1,
						8);
				}
				//cv.imwrite('./data/output/houghCircles.jpg', this.inputImage);
			}
			*/
		}
		/*/////////////
		cv.imwrite('./data/output/houghCircles.jpg', this.inputImage);
		cv.namedWindow('hough',0);
		cv.namedWindow('canny',0);
		cv.imshow("hough", this.inputImage);
		cv.imshow("canny", canny2);
		cv.waitKey();
		*/
	 }
	 
	/**
	 * frees up resources, typically called when finished it's job and
	 * the ROI rectangles are ready.
	 *
	 * @return
	 */
	this.dispose = function(){
		cv.discardMats(this.input);
		this.input = null;
	}
	
	// call constructor
	this.init();
}