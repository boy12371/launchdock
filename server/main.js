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

  if (process.env.DOCKER_HOST) {
    var host = process.env.DOCKER_HOST.split(":",2)[1].slice(2);
    var port = process.env.DOCKER_HOST.split(":",3)[2];
  } else {
    var host = 'http://127.0.0.1';
    var port = '2375';
  }
  console.log ("failed to connect to docker daemon on docker0. trying "+host+":"+port)
  dockerProxy = DockerActions.get(host, port);

  if (!dockerProxy)
   throw new Meteor.Error("Could not get dockerProxy server");
}

//
//  establish connection to hipache redis after we have hipache-npm container
//
function hipacheConnect(containerInfo) {
  console.log("Connect to hipache-npm redis instance")
  if (containerInfo) {
    var hostConfig = containerInfo.NetworkSettings.Ports["6379/tcp"][0];
    var platform = os.platform(), d;
    Meteor.setTimeout(function() {
      if (platform === "darwin") {
        Hipache = redis.createClient(hostConfig.HostPort, hostConfig.HostIp); //local
      } else {
        Hipache = redis.createClient(6379, containerInfo.NetworkSettings.IPAddress); //docker instances
      }
    }, 2000); // give redis time to start on container
  }
};

//
// Check to see if hipache is running, paused, or never pulled.
//
var proxyRepo = 'ongoworks/hipache-npm:latest'
var container = dockerProxy.getContainer('hipache-npm'), containerInfo;

try {
  containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
} catch (e) {
 console.log("No existing hipache-npm containers found.");
}

//
// We're going to check status of hipache and restart if needed.
//
if (containerInfo) {
  if (containerInfo.State.Running === false) {
    console.log("Attempting to restart existing hipache-npm container");
    Meteor._wrapAsync(container.restart.bind(container))();

    containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
    hipacheConnect(containerInfo);
    return;
  } else {
    // container already running, just connect
    hipacheConnect(containerInfo);
  }
} else { // we're going to pull the latest, regardless if it exists
  try {
      console.log("Pulling the ongoworks/hipache-npm image.");
      dockerProxy.pull(proxyRepo, function (err, stream) {
        stream.pipe(process.stdout);
      });
  } catch (error) {
    console.log("Error pulling hipache-npm, suggest manual docker pull ongoworks/hipache-npm")
    return;
  }
  //
  // Looping check of download progress
  // this might go on forever if network/download issues
  //
  var intervalId = Meteor.setInterval(function() {
    console.log("Checking download progress of hipache-npm")
    try {
      var images = Meteor._wrapAsync(dockerProxy.listImages.bind(dockerProxy))();
    } catch (e) {
      console.log("Connection error, retrying...");
    }
    _.each(images, function (image) {
        if (_.contains(image.RepoTags, proxyRepo)) {
          console.log("Docker hipache-npm image downloaded. starting hipache-npm now")
          //if the image exists we'll start it up
          try {
            container = Meteor._wrapAsync(dockerProxy.createContainer.bind(dockerProxy))({
              Image: proxyRepo,
              name: 'hipache-npm',
              ExposedPorts: {
                "6379/tcp": {}, // docker will auto-assign the host port this is mapped to
                "80/tcp": {}
              }
            });
            Meteor._wrapAsync(container.start.bind(container))({"PortBindings": { "6379/tcp": [{ "HostIp": "0.0.0.0" }],"80/tcp": [{ "HostIp": "0.0.0.0", "HostPort": "80" }] } });
            containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
            Meteor.clearInterval(intervalId);
            hipacheConnect(containerInfo);
          } catch (e) {
            console.log("Failed to start hipache-npm container.")
          }
        }
     });
  }, 3000);
}