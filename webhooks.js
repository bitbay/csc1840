var pusher = require('./pusher.js'),
	crypto = require('crypto');

exports.hook = function(req, res){
	console.log('webhooking');
	// environmental variable must be set
	var app_secret = pusher.options.secret;
	// key not really needed...
	var app_key = req.get('X-Pusher-Key');
	var webhook_signature = req.get('X-Pusher-Signature');	

	var hmac = crypto.createHmac("sha256", app_secret);
	
	// wait till all the data arrives...
    req.on("data", function(data) {
        hmac.update(data);
    });

    req.on("end", function() {
        var crypted = hmac.digest("hex");

        if(crypted === webhook_signature) {
            // Valid request
    		console.log(req.body);
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
};
