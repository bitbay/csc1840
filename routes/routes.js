/*
 * GET index page.
 */
var sys = require("sys");
exports.index = function(req, res) {
	sys.puts("rendering index");
	res.render('index');
};

