##Installation / deployment

### Setting up project folder

Create a folder in Your workspace:
	$ cd ~/workspace
	$ mkdir csc1840

### Getting source

Unpack the submitted zip archive:
	$ unzip csc1840.zip
	
or alternatively get source from git:
	$ git clone https://github.com/bitbay/csc1840.git

## Heroku setup

### Creating application

Create a new application with the heroku command-line client (or toolchain) using custom buildpack*:
	$ heroku create {app} --buildpack https://github.com/bitbay/heroku-buildpack-nodejs.git

* This buildpack based on the heroku-buildpack-nodejs and adds support for OpenCV 2.4.2 with <strong>codeboost</strong>'s <a href="https://github.com/codeboost/opencv-node">opencv-node</a>.
It has the compiled libraries of openCV and the nesessary steps to unpack/monkey-patch/deploy it into the slug.
To read the full story on how i created it wait for VULCAN.md...comming soon!

### Installing add-ons needed by the application

The application uses mongodb for session-pesistent data.

Add mongodb add-on (mongolab):
	$ heroku addons:add mongolab:starter

Add pusher to application for websocket support:
	$ heroku addons:add pusher:sandbox

### Configure environment variables

Both mongolab and pusher set these variables for the user.
	MONGOLAB_URI
	PUSHER_KEY
	PUSHER_APP_ID
	PUSHER_SECRET
	
The env vars needed by OpenCV 2.4.2 are set up by the buildpack at slug compile time, so no need to do it manually.
(Since it monkey-patches opencv.pc to the correct, installed libs folder)

## Deploy to heroku

Once created, push the git source to the heroku master branch:
	$ git push heroku master


## System architecture

TODO.
