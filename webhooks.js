var pusher = require('./pusher.js'),
	crypto = require('crypto');

/*
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
*/
exports.hook = function(req, res){
	console.log('webhooked');
	// environmental variable must be set
	var app_secret = pusher.object.secret;

	var app_key = req.get('X-Pusher-Key');
	var webhook_signature = req.get('X-Pusher-Signature');

	//$expected_signature = hash_hmac( 'sha256', $body, $app_secret, false );
	var expected_signature = crypto.createHmac(crypto.SHA256, app_secret)
		.update(req.body)
		.digest('hex');
		
	if(webhook_signature == expected_signature) {
		//$payload = json_decode($body);
		/*
		foreach($payload['events'] as &$event) {
		  // do something with the event
		}
		*/
		console.log(req.body);
		res.status(200).end();
	}
	else {
		res.status(401).end();
	}
};
