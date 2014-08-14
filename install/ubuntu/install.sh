#!/bin/bash
apt-get update && apt-get -qqy upgrade curl git gcc make build-essential imagemagick nodejs npm

# install docker
curl -s https://get.docker.io/ubuntu/ | sudo sh
echo "DOCKER_OPTS=\"-H tcp://0.0.0.0:2375 -H unix://var/run/docker.sock\"" >> /etc/default/docker
usermod -aG docker ubuntu
service docker restart

#!/bin/bash
# Install required packages first
#
curl https://install.meteor.com | /bin/sh
npm cache clean -f && npm install -g n && n 0.10.29
npm install --silent -g forever meteorite phantomjs


# Add your Meteor application to source and bundle it to run as node app
mkdir /var/www/source && cd /var/www/source
# clone your project repository (or download,untar,etc)
git clone https://github.com/ongoworks/launchdock.git .
# Bundle meteorsrc to /var/www/app
mrt install && meteor bundle --directory /var/www/app


# install mongodb
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/mongodb.list
apt-get update
apt-get install mongodb-org
service mongod start

#
# Default ENV settings for meteor app
# Required to run meteor!
# either change these to your production settings or install mongodb
#
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/mongodb.list
apt-get install mongodb-org
#
#
export PORT=8080
export ROOT_URL="http://127.0.0.1"
export MONGO_URL="mongodb://127.0.0.1:27017/meteor"

# Set the working directory to be used for commands that are run
cd /var/www/app
touch .foreverignore
# Define default command that runs the node app on container port 8080
forever -w ./main.js