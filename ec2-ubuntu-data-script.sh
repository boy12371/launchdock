#!/bin/bash
apt-get update
apt-get install -qqy gcc make build-essential
curl -sL https://get.docker.io/ | sh
usermod -aG docker ubuntu
service docker restart
docker pull ongoworks/hipache-npm
docker pull ongoworks/meteor-launcher
reboot