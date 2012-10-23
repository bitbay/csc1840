/*
 * GET index page.
 */
var session = require('../session'),
	path = require('path'),
	sys = require("sys");

exports.index = function(req, res) {
		sys.puts("rendering index");
		
		// getting user images + default images
		sys.puts( session.queryImages() );
		var data = {
			images: [
				{
					url: 'data/upload/woman.jpg',
					title: 'sample-1'
				}
			],
			channel: req.session.id
		};
		res.render('index',{data:data});

};

