// Set up variables used throughout

fs = Npm.require('fs');
request = Npm.require('request');
os = Npm.require('os');

// Set server dir for use everywhere
serverDir = __meteor_bootstrap__ && __meteor_bootstrap__.serverDir;
if (!serverDir) {
    throw new Error("Unable to determine the server directory");
}

if (!Meteor.settings.dockerSSL) {
  Meteor.settings.dockerSSL = {
    "path": serverDir  + "/assets/app/docker",
    "ca": "ca.pem",
    "cert": "cert.pem",
    "key": "key.pem"
  }
}
// dockerProxy = the docker server running the hipache-npm proxy as a docker container
// you can pass different settings in settings.json
// otherwise fallback to first DOCKER_HOST if set in ENV
// and if neither of those existing, we'll use localhost defaults
if (Meteor.settings.docker) {
  var host = Meteor.settings.docker.host;
  var port = Meteor.settings.docker.port;
} else if (process.env.DOCKER_HOST) {
  var host = process.env.DOCKER_HOST.split(":",2)[1].slice(2);
  var port = process.env.DOCKER_HOST.split(":",3)[2];
} else {
  var host = '127.0.0.1';
  var port = '2375';
}

console.log("Attempting docker daemon connection on " + host + ":" + port);
try {
  dockerProxy = DockerActions.get( {host: host, port: port} );
}
catch (e) {
  console.log("Could not connect to docker daemon on " + host + ":" + port + ",attempting socketPath connect.");
  dockerProxy = DockerActions.get({socketPath: '/var/run/docker.sock'});
}

// well, we failed to connect to any docker daemon.
if (!dockerProxy) {
  throw new Meteor.Error("400","Failed to connect to any docker daemon");
}

//
//  establish connection to hipache redis after we have hipache-npm container
//
function hipacheConnect(containerInfo) {
  console.log("Connect to hipache-npm redis instance");
  if (containerInfo) {
    var hostConfig = containerInfo.NetworkSettings.Ports["6379/tcp"][0];
    var platform = os.platform(), d;
    Meteor.setTimeout(function() {
      if (platform === "darwin") {
        var host = process.env.DOCKER_HOST.split(":",2)[1].slice(2) || Meteor.settings.docker.host || hostConfig.HostIp;
        try {
          Hipache = redis.createClient(hostConfig.HostPort, host); //local
        } catch (e) {
          console.log ("Unable to connect to hipache redis. Checking hipach-npm installation.")
        }
      } else {
        try {
          Hipache = redis.createClient(6379, containerInfo.NetworkSettings.IPAddress); //running as docker instances
        } catch (e) {
          console.log ("Unable to connect to hipache redis. Checking hipach-npm installation.")
        }
      }
    }, 2500); // give redis time to start on container
  }
}

//
// Check to see if hipache is running, paused, or never pulled.
//
var proxyRepo = Meteor.settings.proxyRepo || 'ongoworks/hipache-npm:latest';
var container = dockerProxy.getContainer('hipache-npm'), containerInfo;

try {
  containerInfo = Meteor.wrapAsync(container.inspect.bind(container))();
} catch (e) {
 console.log("No existing hipache-npm containers found.");
}

//
// We're going to check status of hipache and restart if needed.
//
if (containerInfo) {
  if (containerInfo.State.Running === false) {
    console.log("Attempting to restart existing hipache-npm container");
    Meteor.wrapAsync(container.restart.bind(container))();

    containerInfo = Meteor.wrapAsync(container.inspect.bind(container))();
    hipacheConnect(containerInfo);
    return;
  } else {
    // container already running, just connect
    hipacheConnect(containerInfo);
  }
} else { // we're going to pull the latest, regardless if it exists
  try {
    dockerProxy.pull(proxyRepo, function (err, stream) {
      console.log("Pulling the ongoworks/hipache-npm image.");
    });
  } catch (error) {
    console.log("Error pulling hipache-npm, suggest manual docker pull ongoworks/hipache-npm");
    return;
  }
  //
  // Looping check of download progress
  // this might go on forever if network/download issues
  //
  var intervalId = Meteor.setInterval(function() {
    console.log("Checking download progress of hipache-npm");
    try {
      var images = Meteor.wrapAsync(dockerProxy.listImages.bind(dockerProxy))();
    } catch (e) {
      console.log("Connection error, retrying...");
    }
    _.each(images, function (image) {
        if (_.contains(image.RepoTags, proxyRepo)) {
          console.log("Docker hipache-npm image downloaded. spinning up hipache-npm now");
          //if the image exists we'll start it up
          try {
            container = Meteor.wrapAsync(dockerProxy.createContainer.bind(dockerProxy))({
              Image: proxyRepo,
              name: 'hipache-npm',
              ExposedPorts: {
                "6379/tcp": {}, // docker will auto-assign the host port this is mapped to
                "80/tcp": {}
              }
            });
            Meteor.wrapAsync(container.start.bind(container))({"PortBindings": { "6379/tcp": [{ "HostIp": "0.0.0.0" }],"80/tcp": [{ "HostIp": "0.0.0.0", "HostPort": "80" }] } });
            containerInfo = Meteor.wrapAsync(container.inspect.bind(container))();
            Meteor.clearInterval(intervalId);
            hipacheConnect(containerInfo);
          } catch (e) {
            console.log("Failed to start hipache-npm container. Retrying...");
          }
        }
     });
  }, 4500);
}
