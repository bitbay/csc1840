#### Installation / deployment

## Setting up project folder

Create a folder in Your workspace:
	$ cd ~/workspace
	$ mkdir csc1840

## Getting source

Unpack the submitted zip archive:
	$ ....put.extract.command.here....
	
or alternatively get source from git:
	$ git clone ....put.git.repo.here....

#### Heroku setup

## Creating application

Create a new application with the heroku command-line client (or toolchain) using custom buildpack*:
	$ heroku create csc1840 --buildpack https://github.com/bitbay/heroku-buildpack-nodejs.git

* This buildpack based on the heroku-buildpack-nodejs and adds support for OpenCV 2.4.2 with codeboost's opencv-node.
It has the compiled libraries of openCV and the nesessary steps to unpack/monkey-patch/deploy it.
To read the full story on how i created it check out VULCAN.md

## Installing add-ons

The application uses mongodb for session-pesistent data and 
Add mongodb add-on (mongolab):
	$ heroku addons:add mongolab:starter

Add pusher to application for websocket support:
	$ heroku addons:add pusher:sandbox

## Configuring add-ons, heroku dashboard

# Enable client events

Goto http://app.pusherapp.com/apps/{app}/settings and check 

# Enable webhooks

Goto http://app.pusherapp.com/apps/{app}/web_hooks and check 'Enable webhooks' and set 'Channel existence'.
Set 'Url' to the (to-be)deployed applications 'webhooks' route:
	http://{app}.herokuapp.com/webhooks

## Configure environment variables

Setup heroku with credentials retrieved from heroku application dashboard:
	$ heroku config:set .... 
	$ heroku config:set .... 
	$ heroku config:set .... 

Configure OpenCV environment variables
	$ heroku config:set ....
	$ heroku config:set .... 
	$ heroku config:set .... 

(Mongolab already sets MONGOLAB_URI for You)

#### Deploy to heroku

Once created, push the git source to the heroku master branch:
	$ git push heroku master
	
## ?
