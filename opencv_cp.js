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

		// read img
		inputImage.src = src;
		inputImage.mat = cv.imread(inputImage.src, 1);
		
		pusher.trigger( channel, 'opencv-info', {msg:'Image reading done'});
		
		var detector = new Detector();
		var roi = detector.getROI(inputImage.mat);
		process.send({roi:roi});
		
		//debugResultsROI(results);
		var iris = detector.getIris();
		process.send({ iris:iris });
//	}
};

function debugResultsROI(ROI){
	var result = inputImage.mat.clone();
	var rect;
	var i=0;
	for (i; i < ROI.faces.length; ++i) {
	  rect = ROI.faces[i];
	  cv.rectangle(result, {
		x: rect.x,
		y: rect.y
	  }, {
		x: rect.x + rect.width,
		y: rect.y + rect.height
	  }, [255, 0, 0], 2);
	};
	for (i=0; i < ROI.eyes.length; ++i) {
	  rect = ROI.eyes[i];
	  cv.rectangle(result, {
		x: rect.x,
		y: rect.y
	  }, {
		x: rect.x + rect.width,
		y: rect.y + rect.height
	  }, [0, 255, 0], 2);
	};

	//cv.imwrite('/data/output/result.jpg', result);
}
process.on('message', function(m) {
  console.log('CHILD got message:');
  init(m);
});
