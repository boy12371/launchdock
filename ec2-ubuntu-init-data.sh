#!/bin/bash
apt-get update && apt-get -qqy upgrade
apt-get install -qqy gcc make build-essential
curl -s https://get.docker.io/ubuntu/ | sudo sh
echo "DOCKER_OPTS=\"-H tcp://0.0.0.0:2375 -H unix://var/run/docker.sock\"" >> /etc/default/docker
usermod -aG docker ubuntu
service docker restart
reboot