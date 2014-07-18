// Set up variables used throughout

fs = Npm.require('fs');
request = Npm.require('request');
os = Npm.require('os');

// Set server dir for use everywhere
serverDir = __meteor_bootstrap__ && __meteor_bootstrap__.serverDir;
if (!serverDir) {
    throw new Error("Unable to determine the server directory");
}

// dockerProxy = the docker server running the proxy
// currently, we assume it's on the same server running rocker docker
dockerProxy = DockerActions.get('http://172.17.42.1', 2375);

if (!dockerProxy)
	throw new Error("Could not get dockerProxy server");

// Find hipache redis port and create global `Hipache` client for use everywhere
var container = dockerProxy.getContainer('hipache-npm'), containerInfo;
try {
	containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
} catch (e) {
	throw new Error('You must start a hipache container named "hipache-npm" before running the launcher app. Use the command: docker run --name hipache-npm -p ::6379 -p 80:80 -d ongoworks/hipache-npm');
}

var hostConfig = containerInfo.NetworkSettings.Ports["6379/tcp"][0];
var platform = os.platform(), d;

if (platform === "darwin") {
	Hipache = redis.createClient(hostConfig.HostPort, hostConfig.HostIp); //local
} else {
	Hipache = redis.createClient(6379, containerInfo.NetworkSettings.IPAddress); //docker instances
}

// Do 10 second polling of host and app instance details
Meteor.startup(function () {
  Meteor.setInterval(function () {
    HostActions.updateAll();
    ContainerActions.updateInfoForAll();
  }, 30000);
});