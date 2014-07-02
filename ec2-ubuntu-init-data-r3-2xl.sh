#!/bin/bash
apt-get update && apt-get -qqy upgrade
apt-get install -qqy gcc make build-essential redis-cli
curl -s https://get.docker.io/ubuntu/ | sudo sh
echo "DOCKER_OPTS=\"-H tcp://0.0.0.0:2375 -H unix://var/run/docker.sock\"" >> /etc/default/docker
usermod -aG docker ubuntu
mkswap /dev/xvdb
swapon /dev/xvdb
echo "/dev/xvdb swap swap defaults 0 0" | tee -a /etc/fstab
echo "GRUB_CMDLINE_LINUX=\"cgroup_enable=memory swapaccount=1\"" >> /etc/default/grub
update-grub && reboot