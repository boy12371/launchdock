#!/bin/bash
apt-get update
apt-get upgrade -y
echo DOCKER_OPTS=\"-H tcp://127.0.0.1:4243 -H unix:///var/run/docker.sock\" >> /etc/default/docker.io
apt-get install -y docker.io
ln -sf /usr/bin/docker.io /usr/local/bin/docker
useradd meteoruser
usermod -aG docker meteoruser
usermod -aG docker ubuntu
service docker.io restart