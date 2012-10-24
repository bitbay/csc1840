var Pusher = require('node-pusher');

var pusher = new Pusher({
    appId: '30220',
    key: '0869d75e9733f63ecf53',
    secret: '64cc9a5241126714e3bb'
});

module.exports = pusher;
