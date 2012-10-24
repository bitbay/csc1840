/*
 * GET index page.
 */
var session = require('../session'),
	path = require('path'),
	pusher = require('../pusher'),
//	Pusher = require('node-pusher'),
	
	sys = require("sys");


exports.index = function(req, res) {
		sys.puts('rendering index for ' + req.session.channelId);
		var data = {
			images: [],
			pusher_key: pusher.options.key,
			channel: req.session.channelId
		};
		res.render('index',data);

};

