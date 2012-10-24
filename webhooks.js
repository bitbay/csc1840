var pusher = require('./pusher.js'),
	pusher_server = require('./pusher_server.js'),
	crypto = require('crypto');

var channels_watched = [];

exports.hook = function(req, res){
	console.log('webhooking - all request go!');
	console.log(req.body.events);
	
	// Valid request (for now, without authetification at all...
	// @see below
	for(var i=0; i< req.body.events; ++i)
	{
		// visitor arrived...
		if (req.body.events[i].name === 'channel_occupied') {
			var channel = req.body.events[i].channel;
			// greet the user, this could be the beginning of a beautiful
			// friendship...
			console.log('sending greet');
			pusher_server.watchVisitor(req.body.events[i].channel);
			pusher.trigger(req.body.events[i].channel, 'greet', {msg:'Welcome!'});
		}
		// visitor left
		if (req.body.events[i].name === 'channel_occupied') {
			var channel = req.body.events[i].channel;
			console.log('sending bye');
			pusher_server.unwatchVisitor(req.body.events[i].channel);
		}
	}
	
	res.status(200).end();
	
	/* This feature had a LOT of bugs (heroku and pusher), request timeouts and
	 * what not.
	 * Long story short - cut it out, since this is a demo and not a production
	 * application...
	 * I leave it here, for the case it gets resolved.
	 */
	/*
	// environmental variable must be set
	var app_secret = pusher.options.secret;
	// key not really needed...
	var app_key = req.get('X-Pusher-Key');
	var webhook_signature = req.get('X-Pusher-Signature');	

	var hmac = crypto.createHmac("sha256", app_secret);
	var bodyData = '';
	// wait till all the data arrives...
    req.on("data", function(data) {
        //hmac.update(data);
        bodyData += data;
        console.log('recieving data...');
    });

    req.on("end", function() {
    	hmac.update(bodyData);
        var crypted = hmac.digest("hex");

        if(crypted === webhook_signature) {
            // Valid request
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
        } else {
            // Invalid request
            res.status(401).end();
        }
    });

    req.on("error", function(err) {
        return next(err);
    });
    */
};
