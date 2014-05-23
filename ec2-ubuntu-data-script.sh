#!/bin/bash
apt-get update
apt-get install -qqy gcc make build-essential
curl -sL https://get.docker.io/ | sh
echo DOCKER_OPTS=\"-H tcp://127.0.0.1:4243 -H unix:///var/run/docker.sock\" >> /etc/default/docker.io
usermod -aG docker ubuntu
service docker restart
docker run -e MONGO_URL="mongodb://127.0.0.1:3002" -e ROOT_URL="http://127.0.0.1" -e PORT="8000" -p 8000:8000 -d ongoworks/meteor-launcher