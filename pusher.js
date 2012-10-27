/**
 * Cloudspokes challenge #1840
 * 
 * Pusher class, wrapper for pusher.com services.
 *
 * @author daniel@bitbay.org
 * @version
 */
var Pusher = require('node-pusher');

// private api-key, these get set as environment variables in heroku by pusher
var pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET
});

module.exports = pusher;
