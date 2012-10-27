# Installation / deployment

## Setting up project folder

Create a folder in Your workspace:<br>
<code>$ cd ~/workspace</code><br>
<code>$ mkdir csc1840</code>

## Getting source

Unpack the submitted zip archive:<br>
<code>$ unzip csc1840.zip</code>
	
or alternatively get source from git:<br>
<code>$ git clone https://github.com/bitbay/csc1840.git</code>

# Heroku setup

## Creating application

Create a new application with the heroku command-line client (or toolchain) using custom buildpack*:<br>
<code>$ heroku create {app} --buildpack https://github.com/bitbay/heroku-buildpack-nodejs.git</code>

* This buildpack based on the heroku-buildpack-nodejs and adds support for OpenCV 2.4.2 with <strong>codeboost</strong>'s <a href="https://github.com/codeboost/opencv-node">opencv-node</a>.
It has the compiled libraries of openCV and the nesessary steps to unpack/monkey-patch/deploy it into the slug.
To read the full story on how i created it wait for VULCAN.md...to be updated!

## Installing add-ons needed by the application

The application uses <strong>mongodb</strong> for session-pesistent data

Add mongodb add-on (mongolab):<br>
<code>$ heroku addons:add mongolab:starter</code>

Add pusher to application for websocket support:<br>
<code>$ heroku addons:add pusher:sandbox</code>

## Configure environment variables

Both mongolab and pusher set these variables for the user.<br>
<code>MONGOLAB_URI</code>
<code>PUSHER_KEY</code>
<code>PUSHER_APP_ID</code>
<code>PUSHER_SECRET</code>
	
The env vars needed by OpenCV 2.4.2 are set up by the buildpack at slug compile time, so no need to do it manually.
(Since it monkey-patches opencv.pc to the correct, installed libs folder)

## Deploy to heroku

Once created, push the git source to the heroku master branch:<br>
<code>$ git push heroku master</code>

# System architecture

TODO.
