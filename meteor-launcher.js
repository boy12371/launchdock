AppInstances = new Meteor.Collection("AppInstances");

if (Meteor.isServer) {
  var fs = Npm.require('fs');
  var request = Npm.require('request');

  Meteor.publish("appInstances", function () {
    return AppInstances.find();
  });

  function getDocker() {
    // For now we connect on the same server instance
    //return new Docker({socketPath: '/var/run/docker.sock'}); // Use this one on Linux
    return new Docker({host: 'http://127.0.0.1', port: 4243}); // Use this one on Mac OSX, or linux where docker is configured to use port

    // To connect to another instance: (but careful because exposing on host gives root access, so that port should not be public to the Internet)
    //return new Docker({host: 'http://192.168.1.10', port: 3000});
  }

  Meteor.methods({
    launchAppInstance: function (options) {
      options = options || {};

      this.unblock();

      if (typeof options.appImage !== "string") {
        throw new Meteor.Error(400, 'Bad request', "You must pass the appImage option set to the string name of the docker image to use.");
      }

      // For now we'll put all containers on the same instance as the launcher; this could be
      // passed in or we could use some kind of logic to figure out which instances can handle
      // more containers or if we need to create a new server instance
      var host = options.host || '127.0.0.1';
      // Should be passed in; maybe have a separate method that launches mongo instances; or let caller do that
      var mongoUrl = options.mongoUrl || 'mongodb://test:abcd2Fire@oceanic.mongohq.com:10061/reaction_eric_test';
      // TODO set this properly and also make a method for changing it
      var rootUrl = options.rootUrl || 'http://reaction.meteor.com';

      var docker = getDocker();

      // Create a new container
      var container = Meteor._wrapAsync(docker.createContainer.bind(docker))({
        Image: options.appImage,
        Env: [
          'MONGO_URL=' + mongoUrl,
          'ROOT_URL=' + rootUrl
        ],
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
        containerId: containerId,
        createdAt: new Date,
        running: containerInfo.State.Running ? "running" : "stopped"
      });

      // TODO get container status and set initial status in AppInstance here because the events probably already came in

      // Return the app instance ID for use in future calls; calling app should store this somewhere
      return newInstance;
    },
    restartAppInstance: function (instanceId) {
      this.unblock();
      var ai = AppInstances.findOne({_id: instanceId});

      // Get the container
      var docker = getDocker();
      var container = docker.getContainer(ai.containerId);

      // Restart container
      Meteor._wrapAsync(container.restart.bind(container))();

      return true;
    },
    startAppInstance: function (instanceId) {
      this.unblock();
      var ai = AppInstances.findOne({_id: instanceId});

      // Get the container
      var docker = getDocker();
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
      var docker = getDocker();
      var container = docker.getContainer(ai.containerId);

      // Stop container
      Meteor._wrapAsync(container.stop.bind(container))();

      return true;
    },
    killAppInstance: function (instanceId) {
      this.unblock();
      var ai = AppInstances.findOne({_id: instanceId});

      // Get the container
      var docker = getDocker();
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

      var docker = getDocker();
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
        HTTPProxy.HostNameMap.remove({hostname: hostname});
      });

      // Remove app instance from collection
      if (AppInstances.remove({_id: instanceId}) === 0) {
        throw new Meteor.Error(500, 'Internal server error', "Failed to remove app instance with ID " + instanceId);
      }

      return true;
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
      HTTPProxy.HostNameMap.insert({hostname: hostname, target: {host: ai.host, port: ai.port}});
      return true;
    },
    removeHostname: function (instanceId, hostname) {
      this.unblock();
      check(instanceId, String);
      check(hostname, String);

      // Remove this hostname from the AppInstance info
      AppInstances.update({_id: instanceId}, {$pull: {hostnames: hostname}});
      // Inform the proxy server that it no longer needs to route the provided hostname to the provided instance
      HTTPProxy.HostNameMap.remove({hostname: hostname});
      return true;
    },
    buildImageIfNotExist: function (imageName, archiveUrl) {
      this.unblock();
      check(imageName, String);
      check(archiveUrl, String);

      var docker = getDocker();
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
      var docker = getDocker();
      var container = docker.getContainer(ai.containerId);

      // Return container info
      return Meteor._wrapAsync(container.inspect.bind(container))();
    }
  });

  Meteor.startup(function () {
    HTTPProxy.start({port: Meteor.settings.proxyPort, fallbackTarget: Meteor.settings.proxyFallbackTarget});

    // Listen for docker events
    var docker = getDocker();
    docker.getEvents({since: ((new Date().getTime()/1000) - 60).toFixed(0)}, Meteor.bindEnvironment(function(err, stream) {
      if(err) {
        console.log("docker event error:", err);
      } else {
        stream.on('data', Meteor.bindEnvironment(function (data) {
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

  Template.appInstances.instances = function () {
    return AppInstances.find({}, {sort: {createdAt: -1}});
  };

  Template.appInstances.shortContainerId = function () {
    return this.containerId.slice(0, 10);
  };
}