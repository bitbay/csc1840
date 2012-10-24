## Setting up project folder

Create a folder in Your workspace:
	$ cd ~/workspace
	$ mkdir csc1840

## Getting source

Unpack the submitted zip archive:
	$ ....put.extract.command.here....
	
or alternatively get source from git:
	$ git clone ....put.git.repo.here....

## Deploing on heroku

Create a new application with the heroku command-line client (or toolchain) with the custom buildpack:
	$ heroku create csc1840 --buildpack https://github.com/bitbay/heroku-buildpack-nodejs.git

Configure OpenCV environment variables

This buildpack based on the heroku-buildpack-nodejs has the compiled libraries of openCV and the nesessary steps to unpack/monkey-patch/deploy it.
To read the full story on how i created it check out VULCAN.md

Setup a mongodb add-on (mongolab or mongohq):
	$ heroku addons:add mongolab:starter

Setup pusher for websocket support:
	$ heroku addons:add pusher:sandbox

Setup pusher with credentials retrieved from heroku application dashboard:
(edit /routes/index.js)

Once created, push the git source to the heroku master branch:
	$ git push heroku master
	
## ?
