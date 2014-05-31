AppInstances = new Meteor.Collection("AppInstances");
DockerImages = new Meteor.Collection("DockerImages");

if (Meteor.isServer) {
  var fs = Npm.require('fs');
  var request = Npm.require('request');
  var os = Npm.require('os');
  var platform = os.platform();

  // Get server dir
  var serverDir = __meteor_bootstrap__ && __meteor_bootstrap__.serverDir;
  if (!serverDir) {
    throw new Error("Unable to determine the server directory");
  }

  Meteor.publish("appInstances", function () {
    return AppInstances.find();
  });

  Meteor.publish("dockerImages", function () {
    return DockerImages.find();
  });

  function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, 0777);
    }
  }

  function buildImageFromGitRepo(gitUrl) {
    // Create a temp directory for this bundle
    var tempBundleDir = path.join(os.tmpdir(), Random.id());
    ensureDir(tempBundleDir);

    // Git clone into the temp dir
    // TODO use git-node pkg?

    // Copy the Dockerfile into the bundle temp dir
    fs.writeFileSync(path.join(tempBundleDir, 'Dockerfile'), fs.readFileSync(path.join(serverDir, 'assets/app/Dockerfile')));

    // Build image from local path
    // var tarFile = ? // TODO need to bundle local path into tar.gz
    //Meteor._wrapAsync(docker.buildImage.bind(docker))(tarFile, {t: imageName, rm: 1});
  }

  function getDocker() {
    // For now we connect on the same server instance
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

  // Find hipache redis port and create client
  var docker = getDocker();
  var container = docker.getContainer('launcher/hipache');
  try {
    var containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
  } catch (e) {
    // TODO we could actually create and start the hipache container here
    // if not already started
    throw new Error('You must start a hipache container named "launcher/hipache" before running the launcher app. Use the command: docker run --name hipache -p ::6379 -p 80:80 -d ongoworks/hipache-npm');
  }
  var hostConfig = containerInfo.NetworkSettings.Ports["6379/tcp"][0];
  Hipache = redis.createClient(6379, containerInfo.NetworkSettings.IPAddress); //docker instances
  //Hipache = redis.createClient(hostConfig.HostPort, hostConfig.HostIp); //local development

  Meteor.methods({
    rebuildAppInstance: function (instanceId) {
      var options = options || {};
      this.unblock();

      var ai = AppInstances.findOne({_id: instanceId});
      options.email = ai.env.METEOR_EMAIL;
      options.rootUrl = ai.env.ROOT_URL;
      options.mongoUrl = ai.env.MONGO_URL;
      options.host = ai.host;
      options.appImage = ai.image;

      console.log("rebuilding instance: "+instanceId);
      // Stop any existing container and start new.
      try {
        Meteor.call("killAppInstance", instanceId);
        Meteor.call("removeAppInstance", instanceId);
      }
      catch(err) {
        console.log ("No existing instance. launching new container: "+options.appImage)
      }

      cloneId = Meteor.call("launchAppInstance", options);

      // TODO loop through hostnames and add additional hostnames from original
      if(ai.hostnames) {
        options.hostname = ai.hostnames[0];
        Meteor.call("addHostname", cloneId, options.hostname);
      }

      console.log("created: "+cloneId);
      return cloneId

    },
    launchAppInstance: function (options) {
      options = options || {};

      this.unblock();

      if (typeof options.appImage !== "string") {
        throw new Meteor.Error(400, 'Bad request', "You must pass the appImage option set to the string name of the docker image to use.");
      }

      if (typeof options.mongoUrl !== "string") {
        throw new Meteor.Error(400, 'Bad request', "You must pass the mongoUrl option set to the MongoDB URL for the app instance's database.");
      }

      if (typeof options.rootUrl !== "string") {
        throw new Meteor.Error(400, 'Bad request', "You must pass the rootUrl option set to the desired root URL for the app instance.");
      }

      // For now we'll put all containers on the same instance as the launcher; this could be
      // passed in or we could use some kind of logic to figure out which instances can handle
      // more containers or if we need to create a new server instance
      var host = options.host || '127.0.0.1';

      // Prepare environment variables
      var env = {
        'MONGO_URL': options.mongoUrl,
        'ROOT_URL': options.rootUrl,// TODO make this changeable with a separate method that selects from assigned hostnames
        'METEOR_EMAIL': options.email
      };
      if (_.isObject(options.env)) {
        _.extend(env, options.env);
      }
      var dockerEnv = _.map(env, function (val, key) {
        return key + '=' + val;
      });

      // Create a new container
      var container = Meteor._wrapAsync(docker.createContainer.bind(docker))({
        Image: options.appImage,
        Env: dockerEnv,
        ExposedPorts: {
          "8080/tcp": {} // docker will auto-assign the host port this is mapped to
        },
      });

      // Start the new container
      Meteor._wrapAsync(container.start.bind(container))({
        "PortBindings": { "8080/tcp": [{ "HostIp": "0.0.0.0" }] }
      });

      // Get info about the new container
      var containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();

      // Get the container's ID
      var containerId = containerInfo.ID;

      // Determine what port the new container was mapped to
      var port = containerInfo.HostConfig.PortBindings["8080/tcp"][0].HostPort;

      // Create a new app instance record
      var newInstance = AppInstances.insert({
        host: host,
        port: port,
        image: options.appImage,
        containerId: containerId,
        createdAt: new Date,
        status: containerInfo.State.Running ? "running" : "stopped",
        env: env
      });
      if (options.hostname) {
        //if hostname is provided, add domain to hipache as a group.
        // new: domain.reactioncommerce.com  domain
        Meteor.call("addHostname", newInstance, options.hostname);
      }
      // Return the app instance ID for use in future calls; calling app should store this somewhere
      return newInstance;
    },
    restartAppInstance: function (instanceId) {
      this.unblock();
      var ai = AppInstances.findOne({_id: instanceId});

      // Get the container
      var container = docker.getContainer(ai.containerId);

      // Restart container
      Meteor._wrapAsync(container.restart.bind(container))();

      return true;
    },
    startAppInstance: function (instanceId) {
      this.unblock();
      var ai = AppInstances.findOne({_id: instanceId});

      // Get the container
      var container = docker.getContainer(ai.containerId);

      // Start container
      Meteor._wrapAsync(container.start.bind(container))({
        "PortBindings": { "8080/tcp": [{ "HostIp": "0.0.0.0" }] }
      });

      return true;
    },
    stopAppInstance: function (instanceId) {
      this.unblock();
      var ai = AppInstances.findOne({_id: instanceId});

      // Get the container
      var container = docker.getContainer(ai.containerId);

      // Stop container
      Meteor._wrapAsync(container.stop.bind(container))();

      return true;
    },
    killAppInstance: function (instanceId) {
      this.unblock();
      var ai = AppInstances.findOne({_id: instanceId});

      // Get the container
      var container = docker.getContainer(ai.containerId);

      // Kill container
      Meteor._wrapAsync(container.kill.bind(container))();

      return true;
    },
    removeAppInstance: function (instanceId) {
      this.unblock();
      check(instanceId, String);

      var ai = AppInstances.findOne({_id: instanceId});

      if (!ai) {
        throw new Meteor.Error(400, 'Bad request', "No app instance has ID " + instanceId);
      }

      var containerId = ai.containerId;

      var containers = Meteor._wrapAsync(docker.listContainers.bind(docker))();

      var exists = _.any(containers, function (container) {
        return container.Id === containerId;
      });

      // If the container still exists, remove it. If not, we don't care.
      if (exists) {
        // Get the container
        var container = docker.getContainer(containerId);

        // Kill container
        Meteor._wrapAsync(container.kill.bind(container))();

        // Remove container
        Meteor._wrapAsync(container.remove.bind(container))();
      }

      // Unregister all hostnames from the proxy server
      _.each(ai.hostnames, function (hostname) {
        //HTTPProxy.HostNameMap.remove({hostname: hostname});
        Meteor.call("removeHostname", instanceId, hostname);
      });

      // Remove app instance from collection
      if (AppInstances.remove({_id: instanceId}) === 0) {
        throw new Meteor.Error(500, 'Internal server error', "Failed to remove app instance with ID " + instanceId);
      }

      return true;
    },
    getEnvironmentVariables: function (instanceId) {
      this.unblock();
      var ai = AppInstances.findOne({_id: instanceId});
      return ai && ai.env;
    },
    addHostname: function (instanceId, hostname) {
      this.unblock();
      check(instanceId, String);
      check(hostname, String);

      // A hostname may only be mapped to one app instance
      var existing = AppInstances.findOne({hostnames: hostname}, {_id: 1})
      if (existing) {
        throw new Meteor.Error(400, 'Bad request', '"' + hostname + '" is already listed as a hostname for the app instance with ID ' + existing._id);
      }

      // Get app instance document
      var ai = AppInstances.findOne({_id: instanceId});
      // Note this hostname in the AppInstance info
      AppInstances.update({_id: instanceId}, {$push: {hostnames: hostname}});
      // Inform the proxy server that it needs to route the provided hostname to the provided instance
      //HTTPProxy.HostNameMap.insert({hostname: hostname, target: {host: ai.host, port: ai.port}});
      // use domain prefix as unique identifier
      if (hostname.split(".").length > 2) {
        var domainId = hostname.split(".")[0];
      } else {
        var domainId = Random.id(8);
      }

      Hipache.rpush('frontend:'+hostname, domainId );
      Hipache.rpush('frontend:'+hostname, "http://"+ai.host+":"+ai.port);
      return true
    },
    removeHostname: function (instanceId, hostname) {
      this.unblock();
      check(instanceId, String);
      check(hostname, String);
      var ai = AppInstances.findOne({_id: instanceId});

      // Remove this hostname from the AppInstance info
      AppInstances.update({_id: instanceId}, {$pull: {hostnames: hostname}});

      // Inform the proxy server that it no longer needs to route the provided hostname to the provided instance
      Hipache.del("hostname", "http://"+ai.host+":"+ai.port)
      return true;
    },
    buildImageIfNotExist: function (imageName, archiveUrl) {
      this.unblock();
      check(imageName, String);
      check(archiveUrl, String);

      var images = Meteor._wrapAsync(docker.listImages.bind(docker))();

      var exists = _.any(images, function (image) {
        return image.RepoTags && _.contains(image.RepoTags, imageName + ":latest");
      });

      if (exists) return true;

      // stream tar file to buildImage
      var tarStream = request(archiveUrl);
      if (!tarStream) {
        throw new Meteor.Error(500, 'Internal server error', "Unable to get build context archive from " + archiveUrl);
      }

      try {
        tarStream.on('error', function (error) { throw error; });
        Meteor._wrapAsync(docker.buildImage.bind(docker))(tarStream, {t: imageName, rm: 1});
      } catch (error) {
        throw new Meteor.Error(500, 'Internal server error', "Error reading " + archiveUrl + ' or building image: ' + (error && error.message ? error.message : 'Unknown'));
      }
      return true;
    },
    getContainerInfo: function (instanceId) {
      this.unblock();
      check(instanceId, String);

      // Get app instance document
      var ai = AppInstances.findOne({_id: instanceId});

      // Get the container
      var container = docker.getContainer(ai.containerId);

      // Return container info
      return Meteor._wrapAsync(container.inspect.bind(container))();
    }
  });


  Meteor.startup(function () {
    // Listen for docker events
    docker.getEvents({since: ((new Date().getTime()/1000) - 60).toFixed(0)}, Meteor.bindEnvironment(function(err, stream) {
      if(err) {
        console.log("docker event error:", err);
      } else {
        stream.on('data', Meteor.bindEnvironment(function (data) {
          console.log("docker event:", data.toString());
          var evt = JSON.parse(data.toString());
          var status;
          if (evt.status === "create") {
            status = "stopped";
          } else if (evt.status === "start") {
            status = "running";
          } else if (evt.status === "restart") {
            status = "running";
          } else if (evt.status === "die") {
            status = "stopped";
          } else if (evt.status === "stop") {
            status = "stopped";
          } else if (evt.status === "kill") {
            status = "stopped";
          } else {
            status = evt.status;
          }
          // Update app instance status
          AppInstances.update({containerId: evt.id}, {$set: {status: status}});
        }, 'docker.getEvents stream data'));
        stream.on('error', function (error) {
          console.log("docker event stream error:", error);
        });
      }
    }, 'docker.getEvents'));
  });

}

if (Meteor.isClient) {
  Meteor.subscribe("appInstances");
  Meteor.subscribe("dockerImages");

  Template.appInstances.instances = function () {
    return AppInstances.find({}, {sort: {createdAt: -1}});
  };

  Template.appInstances.images = function () {
    return DockerImages.find({}, {sort: {name: 1}});
  };

  Template.instanceRow.shortContainerId = function () {
    return (this.containerId || "").slice(0, 10);
  };

  Template.instanceRow.events = {
    'click .start': function (event, template) {
      Meteor.call("startAppInstance", this._id, function () {
        console.log("startAppInstance result:", arguments);
      });
    },
    'click .stop': function (event, template) {
      Meteor.call("stopAppInstance", this._id, function () {
        console.log("stopAppInstance result:", arguments);
      });
    },
    'click .restart': function (event, template) {
      Meteor.call("restartAppInstance", this._id, function () {
        console.log("restartAppInstance result:", arguments);
      });
    },
    'click .kill': function (event, template) {
      Meteor.call("killAppInstance", this._id, function () {
        console.log("killAppInstance result:", arguments);
      });
    },
    'click .remove': function (event, template) {
      var result = confirm("Are you sure you want to delete this site??");
      if (result == true) {
        Meteor.call("removeAppInstance", this._id, function () {
            console.log("removeAppInstance result:", arguments);
        });
      }
    },
    'click .rebuild': function (event, template) {
      Meteor.call("rebuildAppInstance", this._id, function () {
        console.log("rebuildAppInstance result:", arguments);
      });
    },
    'click .info': function (event, template) {
      Meteor.call("getContainerInfo", this._id, function () {
        console.log("getContainerInfo result:", arguments);
      });
    }
  };

  Template.imageRow.events = {
    'click .remove': function (event, template) {
      Meteor.call("removeImage", this._id, function () {
        console.log("removeImage result:", arguments);
      });
    },
    'click .info': function (event, template) {
      Meteor.call("getImageInfo", this._id, function () {
        console.log("getImageInfo result:", arguments);
      });
    }
  };
}