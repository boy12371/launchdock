// Node Requires
fs = Npm.require('fs');
os = Npm.require('os');
// dockerProxy = the docker server running the hipache-npm proxy as a docker container
// you can pass different settings in settings.json
// otherwise fallback to first DOCKER_HOST if set in ENV
// and if neither of those existing, we'll use localhost defaults
// lastly we'll use socketPath connection.

// SETTINGS
var dockerProxy;
if (Meteor.settings.docker) {
  var host = Meteor.settings.docker.host || '127.0.0.1';
  var port = Meteor.settings.docker.port || '2375';
  var protocol = Meteor.settings.docker.protocol || 'http';
  console.log("Attempting " + protocol + " docker daemon connection on " + host + ":" + port);
  dockerProxy = DockerActions.get( {host: host, port: port, protocol: protocol} );
  if (dockerProxy) console.log("Connected to docker "+ host + ":" + port);
}
// ENVIRONMENT
if (!dockerProxy && process.env.DOCKER_HOST) {
  var host = process.env.DOCKER_HOST.split(":",2)[1].slice(2);
  var port = process.env.DOCKER_HOST.split(":",3)[2];
  if (process.env.DOCKER_TLS_VERIFY == 1) {
    var protocol = "https";
  } else {
    var protocol = process.env.DOCKER_HOST.split(":",3)[0];
  }
  console.log("Attempting " + protocol + " docker daemon connection on " + host + ":" + port);
  dockerProxy = DockerActions.get( {host: host, port: port, protocol: protocol} );
  if (dockerProxy) console.log("Connected to docker "+ host + ":" + port);
}
// LOCALHOST
if (!dockerProxy) {
  var host = '127.0.0.1';
  var port = '2375';
  var protocol = 'http';
  console.log("Attempting " + protocol + " docker daemon connection on " + host + ":" + port);
  dockerProxy = DockerActions.get( {host: host, port: port, protocol: protocol} );
  if (dockerProxy) console.log("Connected to docker "+ host + ":" + port);
}
// SOCKETPATH
if (!dockerProxy) {
  console.log("Attempting docker daemon connection with socketPath.");
  dockerProxy = DockerActions.get({socketPath: '/var/run/docker.sock'});
  if (dockerProxy) console.log("Connected to docker via socketPath");
}

// well, we failed to connect to any docker daemon.
if (!dockerProxy) {
  throw new Meteor.Error("400","Failed to connect to any docker daemon");
}
//
//  establish connection to hipache redis after we have hipache-npm container
//  you can pass REDIS_HOST and REDIS_PORT in as env variables if you want to use
//  a different REDIS backend for Redis
//  used locally on OSX we'll use DOCKER_HOST or docker.host from settings.json
//
function hipacheConnect(containerInfo) {

  if (containerInfo) {
    var host = Meteor.settings.redis.host || process.env.REDIS_HOST || containerInfo.NetworkSettings.IPAddress || "127.0.0.1";
    var port = Meteor.settings.redis.port || process.env.REDIS_PORT  || containerInfo.NetworkSettings.Ports["6379/tcp"][0].HostPort || 6379;

    var platform = os.platform(), d;
    Meteor.setTimeout(function() {
      // OSX DEVELOPMENT
      if (platform === "darwin") {
        var localhost = Meteor.settings.redis.host  || process.env.REDIS_HOST  || process.env.DOCKER_HOST.split(":",2)[1].slice(2) || host;
        try {
          Redis = redis.createClient(port, localhost, {no_ready_check: true}); //local
          console.log("Connection established to redis instance: " + localhost + ":" + port);
        } catch (err) {
          throw new Meteor.Error( 500, "HIPACHE: Unable to connect to redis. Checking hipache-npm installation.", err);
        }
      // LINUX PRODUCTION
      } else {
        try {
          Redis = redis.createClient(port, host); //running as docker instances
          console.log("Connection established to redis instance: " + host + ":" + port);
        } catch (err) {
          throw new Meteor.Error( 500, "HIPACHE: Unable to connect to redis. Checking hipache-npm installation.", err);
        }
      }
    }, 2500); // give redis time to start on container
  }
}

//
// Check to see if hipache is running, paused, or never pulled.
// you can set image to specify a docker image of hipache
// export "HIPACHE_IMAGE"="<repo>/<image>"
//
var hipacheImage = process.env.HIPACHE_IMAGE || Meteor.settings.hipache.image || 'ongoworks/hipache-npm:latest';
var hipacheName = process.env.HIPACHE_NAME || Meteor.settings.hipache.name || 'hipache-npm';
// Check container
var container = dockerProxy.getContainer(hipacheName), containerInfo;
try {
  containerInfo = Meteor.wrapAsync(container.inspect.bind(container))();
} catch (e) {
 console.log("No existing "+ hipacheName + " containers found.");
}

//
// We're going to check status of hipache and restart if needed.
//
if (containerInfo) {
  if (containerInfo.State.Running === false) {
    console.log("Attempting to restart existing hipache-npm container");
    Meteor.wrapAsync(container.restart.bind(container))();

    var info = Meteor.wrapAsync(container.inspect.bind(container))();
    hipacheConnect(info);
    return;
  } else {
    // container already running, just connect
    hipacheConnect(containerInfo);
  }
} else { // we're going to pull the latest, regardless if it exists
  try {
    dockerProxy.pull(hipacheImage, function (err, stream) {
      console.log("Pulling the ongoworks/hipache-npm image.");
    });
  } catch (error) {
    console.log("Error pulling "+ hipacheImage + ", suggest manual docker pull ongoworks/hipache-npm");
    return;
  }
  //
  // Looping check of download progress
  // this might go on forever if network/download issues
  //
  var intervalId = Meteor.setInterval(function() {
    console.log("Checking download progress of " + hipacheImage);
    try {
      var images = Meteor.wrapAsync(dockerProxy.listImages.bind(dockerProxy))();
    } catch (e) {
      console.log("Connection error, retrying...");
    }
    _.each(images, function (image) {
        if (_.contains(image.RepoTags, hipacheImage)) {
          console.log("Docker hipache image downloaded. spinning up hipache container now");
          //if the image exists we'll start it up
          try {
            container = Meteor.wrapAsync(dockerProxy.createContainer.bind(dockerProxy))({
              Image: hipacheImage,
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
