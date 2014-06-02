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
	var platform = os.platform(), d;
	if (platform === "darwin") {
	  // We are on OSX; need to connect slightly differently
	  d = new Docker({host: 'http://127.0.0.1', port: 4243});
	} else {
	  // We are on linux
	  d = new Docker({socketPath: '/var/run/docker.sock'});
	}

	listenToDockerEvents(d);

	// To connect to another instance: (but careful because exposing on host gives root access, so that port should not be public to the Internet)
	//d = new Docker({host: 'http://192.168.1.10', port: 3000});
	return d;
}

// Create global `docker` for use everywhere
docker = getDocker();

// Find hipache redis port and create global `Hipache` client for use everywhere
var container = docker.getContainer('hipache-npm'), containerInfo;
try {
	containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
} catch (e) {
	throw new Error('You must start a hipache container named "hipache" before running the launcher app. Use the command: docker run --name hipache-npm -p ::6379 -p 80:80 -d ongoworks/hipache-npm');
}

var hostConfig = containerInfo.NetworkSettings.Ports["6379/tcp"][0];
Hipache = redis.createClient(hostConfig.HostPort, hostConfig.HostIp);