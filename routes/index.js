/**
 * web.js - Web server with routing and RESTful API
 *
 * Uses express for the main framework, mongodb for database.
 *
 * author: daniel@bitbay.org
 */
 
/*
 * GET index page.
 */
var session = require('../session'),
	path = require('path'),
	pusher = require('../pusher'),
	
	sys = require("sys");

exports.index = function(req, res) {
		sys.puts('rendering index for ' + req.session.channelId);
		var data = {
			images: [],
			pusher_key: pusher.options.key,
			channel: req.session.channelId,
			auth_endpoint: process.env.PUSHER_ENDPOINT || 'http://localhost:3000/auth'
		};
		res.render('index',data);

};

