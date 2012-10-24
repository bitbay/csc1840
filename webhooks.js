var pusher = require('./pusher.js'),
	crypto = require('crypto');

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
		for(var i=0; i< req.body.events; ++i)
		{
			for( key in req.body.events[i] ){
				console.log( '-----' );
				console.log( key );
				console.log( req.body.events[i][key] );
				console.log( '-----' );
			}
		}
		
		res.status(200).end();
	}
	else {
		res.status(401).end();
	}
};
