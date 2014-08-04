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

if (!dockerProxy) {
  console.log ("failed to connect to docker0. attempting to connect to a 127.0.0.1 docker proxy")
  dockerProxy = DockerActions.get('http://127.0.0.1', 2375);

  if (!dockerProxy)
   throw new Error("Could not get dockerProxy server");
}

// Find hipache redis port and create global `Hipache` client for use everywhere
var container = dockerProxy.getContainer('hipache-npm'), containerInfo;
try {
	containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
} catch (e) {
    console.log("No hipache-npm found, we're creating one.");
    container = Meteor._wrapAsync(dockerProxy.createContainer.bind(dockerProxy))({
          Image: 'ongoworks/hipache-npm',
          name: 'hipache-npm',
          ExposedPorts: {
            "6379/tcp": {}, // docker will auto-assign the host port this is mapped to
            "80/tcp": {}
          }
        });

    Meteor._wrapAsync(container.start.bind(container))({
      "PortBindings": { "6379/tcp": [{ "HostIp": "0.0.0.0" }],"80/tcp": [{ "HostIp": "0.0.0.0", "HostPort": "80" }] }
    });

    try {
      containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
    } catch (e) {
	   throw new Error('You must start a hipache container named "hipache-npm" before running the launcher app. Use the command: docker run --name hipache-npm -p ::6379 -p 80:80 -d ongoworks/hipache-npm');
   }
}
// get network settings from docker info
var hostConfig = containerInfo.NetworkSettings.Ports["6379/tcp"][0];
var platform = os.platform(), d;

if (hostConfig) {
  if (platform === "darwin") {
  	Hipache = redis.createClient(hostConfig.HostPort, hostConfig.HostIp); //local
  } else {
  	Hipache = redis.createClient(6379, containerInfo.NetworkSettings.IPAddress); //docker instances
  }
}
