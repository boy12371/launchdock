// Set up variables used throughout

fs = Npm.require('fs');
request = Npm.require('request');
os = Npm.require('os');

// Set server dir for use everywhere
serverDir = __meteor_bootstrap__ && __meteor_bootstrap__.serverDir;
if (!serverDir) {
    throw new Error("Unable to determine the server directory");
}

function getDocker() {
	// For now we connect on the same server instance
	var platform = os.platform();
	if (platform === "darwin") {
	  // We are on OSX; need to connect slightly differently
	  return new Docker({host: 'http://127.0.0.1', port: 4243});
	} else {
	  // We are on linux
	  return new Docker({socketPath: '/var/run/docker.sock'}); 
	}

	// To connect to another instance: (but careful because exposing on host gives root access, so that port should not be public to the Internet)
	//return new Docker({host: 'http://192.168.1.10', port: 3000});
}

// Create global `docker` for use everywhere
docker = getDocker();

// Find hipache redis port and create global `Hipache` client for use everywhere
var container = docker.getContainer('launcher/hipache'), containerInfo;
try {
	containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
} catch (e) {}

if (!containerInfo) {
	// As a fallback, we try 'hipache', which is what it will be when running a non-containerized launcher
	container = docker.getContainer('hipache');
	try {
	  containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
	} catch (e) {
	  throw new Error('You must start a hipache container named "hipache" before running the launcher app. Use the command: docker run --name hipache -p ::6379 -p 80:80 -d ongoworks/hipache-npm');
	}
}

var hostConfig = containerInfo.NetworkSettings.Ports["6379/tcp"][0];
Hipache = redis.createClient(6379, containerInfo.NetworkSettings.IPAddress); //docker instances
//Hipache = redis.createClient(hostConfig.HostPort, hostConfig.HostIp); //local development