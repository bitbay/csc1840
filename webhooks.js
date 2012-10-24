var pusher = require('./pusher.js'),
	PusherServer = require('pusher-server').PusherServer;

var pusher_server = new PusherServer({
  appId: (process.env.PUSHER_APP_ID || pusher.options.appId),
  key: (process.env.PUSHER_KEY || pusher.options.key),
  secret: (process.env.PUSHER_SECRET || pusher.options.secret)
});

pusher_server.on('connect', function(){
	var pres = pusher_server.subscribe("presence-users", {user_id: "system"});
	pres.on('success', function(){
	});
	pres.on('pusher_internal:member_removed', function(data){
		console.log("member_removed");
	});

	pres.on('pusher_internal:member_added', function(data){
		console.log("member_added");
	});
});

pusher_server.connect();

exports.hook = function(req, res){
	console.log('webhooked');
	res.end();
};
