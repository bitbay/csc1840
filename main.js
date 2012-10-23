var fs = require('fs'),
	walk = require('walk'),
	cv = require('opencv-node'),
	// module of object detection (faces && eyes)
	Detector = require('./detector');
	
var Mat = cv.Mat;

// some default variables used during initialization
var defaultImage = './data/input/test.jpg';
var haarTypes = {
	face: './data/haar/faces/haarcascade_frontalface_default.xml',
	eye: './data/haar/eyes/haarcascade_eye_tree_eyeglasses.xml'
};

// the image object used in the application (mockup || user-uploaded)
var inputImage = {
	url: null,
	mat: null
};

/**
 * Getting command line parameters, used for development.
 * command line check, args [ image, haarType( face || eye) ]
 */
var args = process.argv.splice(2);

inputImage.url = args[0] && fs.existsSync(args[0]) && 
	isImage(args[0]) ? args[0] : defaultImage;

function isImage(img){
	var ext = img.split('.').pop();
	ext.toLowerCase();
	return 	ext === 'jpg' ||
			ext === 'png' ||
			ext === 'tif';
}

var haarType;
if(args[1]){
	for (haar in haarTypes){
		if( haar === args[1] ) haarType = args[1];
	}
}
if(!haarType) haarType = 'face';

/**
 * user uploads image (one person) >>
 * >>	1. check image for face, push result into candidate.face
 *		2. check image for eyes, push result into candidate.eyes
 *		(3. check image for nose, push result into candidate.nose)
 *		4. sanitarize result >> isFace? || ( hasEyes? && hasNose? )
 */

// read img
inputImage.mat = cv.imread(inputImage.url, 1);
console.log('img.loaded...');

var detector = new Detector();
var results = detector.getROI(inputImage.mat);
console.log('detection finished...');
debugResultsROI(results);
detector.getIris();

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
	
	cv.imwrite('./data/output/result.jpg', result);
}

//console.log(inputImage.mat);
