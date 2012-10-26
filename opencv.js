/**
 * Cloudspokes challenge #1840
 * 
 * Main class of the OpenCV port
 * Exposes very few methods, as the work is done by the "detector" class.
 *
 * @author daniel@bitbay.org
 * @version
 */
var fs = require('fs'),
	path = require('path'),
	// compiled c++ library exposed with BEA to the v8 engine
	cv = require('opencv-node'),
	// module of object detection (faces && eyes)
	Detector = require('./detector'),
	// for socket communication
	pusher = require('./pusher.js');

/**
 * Meet the Matrix class.
 * the basis for all the calculus in opencv.
 */
var Mat = cv.Mat;

// the image object used in the application (mockup || user-uploaded)
var inputImage = {
	url: null,
	mat: null
};

/**
 * Main
 *
 * Wraps up the detector class.
 *
 * @param{string}	the url of the image to process
 */
function init( data ){
	var src = data.src,
		channel = data.channel;

	pusher.trigger( channel, 'opencv-info', {msg:'Reading image from disk'});

	// read image into opencv Matrix format
	inputImage.src = src;
	inputImage.mat = cv.imread(inputImage.src, 1);
	
	pusher.trigger( channel, 'opencv-info', {msg:'Image finished loading'});
	
	// instantiate the detector submodule
	var detector = new Detector();
	
	// detect regions of interest (eyes for now)
	var roi = detector.getROI(inputImage.mat);
	process.send({roi:roi});
	
	// use the previously calculated ROIs to get iris center and radius
	var iris = detector.getIris();
	process.send({ iris:iris });
};

// Message from parent process starts calculus
process.on('message', function(msg) {
	console.log("opencv recieved: " + msg);
	init(msg);
});
