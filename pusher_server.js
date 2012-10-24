var	PusherServer = require('pusher-server').PusherServer,
	pusher = require('./pusher.js');

var pusher_server = new PusherServer({
	appId: (process.env.PUSHER_APP_ID || pusher.options.appId),
	key: (process.env.PUSHER_KEY || pusher.options.key),
	secret: (process.env.PUSHER_SECRET || pusher.options.secret)
});

pusher_server.on('connected', function(){
	var pres = pusher_server.subscribe("presence-users", {user_id: "system"});
	
	pres.on('success', function(){
		console.log('presence success');
	});
	pres.on('pusher_internal:member_removed', function(data){
		console.log("presence member_removed");
	});

	pres.on('pusher_internal:member_added', function(data){
		console.log("presence member_added");
	});
});

pusher_server.watchVisitor = function( channel ){
	console.log('watching visitor:' + channel);
};

pusher_server.unwatchVisitor = function( channel ){
	console.log('unwatching visitor:' + channel);
};
module.exports = pusher_server;
