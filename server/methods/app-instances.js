/*
 * Methods related to app instances: prefix with "ai/"
 */

Meteor.methods({
  'ai/launch': function (options) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);

    options = options || {};

    if (typeof options.appImage !== "string") {
      throw new Meteor.Error(400, 'Bad request', "You must pass the appImage option set to the string name of the docker image to use.");
    }

    if (!_.isObject(options.env)) {
      throw new Meteor.Error(400, 'Bad request', "You must pass environment variables in the env option.");
    }
    // TODO env variables should be changeable without relaunching

    if (typeof options.env.ROOT_URL !== "string") {
      throw new Meteor.Error(400, 'Bad request', "You must pass the env.ROOT_URL option set to the desired root URL for the app instance.");
    }

    if (typeof options.env.MONGO_URL !== "string") {
      throw new Meteor.Error(400, 'Bad request', "You must pass the env.MONGO_URL option set to the desired MongoDB URL for the app instance.");
    }
    
    // Create a new app instance record
    var newInstanceId = AppInstances.insert({
      image: options.appImage,
      env: options.env
    });

    // Run and attach a new docker container for it
    ContainerActions.addForAppInstance(newInstanceId);

    if (options.hostname) {
      // If hostname is provided, add domain to hipache as a group.
      Meteor.call("ai/addHostname", newInstanceId, options.hostname);
    }

    HostActions.updateAll();

    // Return the app instance ID for use in future calls; calling app should store this somewhere
    return newInstanceId;
  },
  // Deactivate and then reactivate. End result is a new container,
  // potentially on a different host, and potentially with a newer
  // version of the image.
  'ai/rebuild': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    ContainerActions.removeForAppInstance(instanceId);
    ContainerActions.addForAppInstance(instanceId);
    return true;
  },
  'ai/restart': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = ContainerActions.getForAppInstance(instanceId);

    if (!container) return;

    // Restart container
    Meteor._wrapAsync(container.restart.bind(container))();

    ContainerActions.getInfo(instanceId);
    return true;
  },
  'ai/start': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = ContainerActions.getForAppInstance(instanceId);

    if (!container) return;

    // Start container
    Meteor._wrapAsync(container.start.bind(container))({
      "PortBindings": { "8080/tcp": [{ "HostIp": "0.0.0.0" }] }
    });

    ContainerActions.getInfo(instanceId);
    return true;
  },
  'ai/stop': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = ContainerActions.getForAppInstance(instanceId);

    if (!container) return;

    // Stop container
    Meteor._wrapAsync(container.stop.bind(container))();

    ContainerActions.getInfo(instanceId);
    return true;
  },
  'ai/kill': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = ContainerActions.getForAppInstance(instanceId);

    if (!container) return;

    // Kill container
    Meteor._wrapAsync(container.kill.bind(container))();

    ContainerActions.getInfo(instanceId);
    return true;
  },
  'ai/remove': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    ContainerActions.removeForAppInstance(instanceId);

    // Remove app instance from collection
    if (AppInstances.remove({_id: instanceId}) === 0) {
      throw new Meteor.Error(500, 'Internal server error', "Failed to remove app instance with ID " + instanceId);
    }

    HostActions.updateAll();
    return true;
  },
  // Kills, removes, and detaches the docker container, but keeps
  // the app instance record. Can be "activated" later by
  // starting a new container.
  'ai/deactivate': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    ContainerActions.removeForAppInstance(instanceId);

    HostActions.updateAll();
    return true;
  },
  // Starts a new container for the instance. Only works if there
  // is not already one listed (i.e., it is deactivated).
  'ai/activate': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    ContainerActions.addForAppInstance(instanceId);

    HostActions.updateAll();
    return true;
  },
  'ai/getEnvironmentVariables': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    var ai = AppInstances.findOne({_id: instanceId});
    return ai && ai.env;
  },
  'ai/addHostname': function (instanceId, hostname) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
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
    
    // use domain prefix as unique identifier
    if (hostname.split(".").length > 2) {
      var domainId = hostname.split(".")[0];
    } else {
      var domainId = Random.id(8);
    }

    var dockerHosts = ai.hosts();
    if (!dockerHosts.length) {
      console.log("Can't add hostname because app instance " + instanceId + " does not have dockerHosts listed.");
      return false;
    }
    var dockerHost = dockerHosts[0];

    Hipache.rpush('frontend:'+hostname, domainId );
    Hipache.rpush('frontend:'+hostname, dockerHost.publicHost+":"+ai.port);
    return true;
  },
  'ai/removeHostname': function (instanceId, hostname) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);
    check(hostname, String);

    // Remove this hostname from the AppInstance info
    AppInstances.update({_id: instanceId}, {$pull: {hostnames: hostname}});

    // Inform the proxy server that it no longer needs to route the provided hostname to the provided instance
    Hipache.del("frontend:"+hostname)

    return true;
  },
  'ai/getContainerInfo': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    return ContainerActions.getInfo(instanceId);
  }
});

ContainerActions = {
  // Returns a docker container object for the container that is running the
  // given app instance
  getForAppInstance: function getForAppInstance(instanceId, docker) {
    var ai = AppInstances.findOne({_id: instanceId});
    if (!ai.containerId)
      return null;

    docker = docker || DockerActions.getForAppInstance(instanceId);
    if (!docker) {
      // Down or deleted? Move app elsewhere
      ContainerActions.removeForAppInstance(instanceId, true);
      if (ContainerActions.addForAppInstance(instanceId)) {
        // XXX: danger of infinite looping here?
        return ContainerActions.getForAppInstance(instanceId);
      } else {
        return null;
      }
    }

    // Are there actually any containers on this docker instance with this container ID?
    var containers = Meteor._wrapAsync(docker.listContainers.bind(docker))();
    var exists = _.any(containers, function (container) {
      return container.Id === ai.containerId;
    });

    return exists ? docker.getContainer(ai.containerId) : null;
  },
  getInfo: function getInfo(instanceId) {
    var container = ContainerActions.getForAppInstance(instanceId);
    if (!container)
      return null;

    var info = Meteor._wrapAsync(container.inspect.bind(container))();

    // Update app instance doc with some actual container info
    AppInstances.update({_id: instanceId}, {$set: {
      actualEnv: info.Config && info.Config.Env,
      status: (info.State && info.State.Running) ? "running" : "stopped",
      'container.pid': info.State && info.State.Pid
    }});

    // Return container info
    return info;
  },
  updateInfoForAll: function updateContainerInfoForAllAppInstances() {
    AppInstances.find({containerId: {$exists: true, $ne: null}}).forEach(function (appInstance) {
      ContainerActions.getInfo(appInstance._id);
    });
  },
  removeForAppInstance: function removeForAppInstance(instanceId, skipDocker) {
    var ai = AppInstances.findOne({_id: instanceId});

    if (!ai)
      return false;

    // Unregister all hostnames from the proxy server since
    // they point to the container being removed.
    _.each(ai.hostnames, function (hostname) {
      Hipache.del("frontend:"+hostname)
    });

    // We remove the docker container if we have one, otherwise ignore it
    if (skipDocker !== true) {
      var container = ContainerActions.getForAppInstance(instanceId);
      if (container) {
        // Kill container
        Meteor._wrapAsync(container.kill.bind(container))();

        // Remove container
        Meteor._wrapAsync(container.remove.bind(container))();
      }
    }

    // Remove container ID from AI record
    AppInstances.update({_id: instanceId}, {
      $unset: {
        containerId: "",
        container: "",
        actualEnv: "",
        port: "",
        dockerHosts: ""
      }
    });
  },
  addForAppInstance: function addForAppInstance(instanceId) {
    var ai = AppInstances.findOne({_id: instanceId});

    if (!ai) {
      // Bad instanceId
      return false;
    }

    if (ai.containerId) {
      // Already has a container running
      return true;
    }

    // Determine the best host and get a Docker instance for it
    var hostDoc = HostActions.getBest();
    if (!hostDoc)
      return false;

    var docker = DockerActions.get(hostDoc.privateHost, hostDoc.port);
    if (!docker)
      return false;

    // Prep env variables
    var dockerEnv = _.map(ai.env, function (val, key) {
      return key + '=' + val;
    });

    // Create a new container
    var container = Meteor._wrapAsync(docker.createContainer.bind(docker))({
      Image: ai.image,
      Env: dockerEnv,
      ExposedPorts: {
        "8080/tcp": {} // docker will auto-assign the host port this is mapped to
      }
    });

    // Start the new container
    Meteor._wrapAsync(container.start.bind(container))({
      "PortBindings": { "8080/tcp": [{ "HostIp": "0.0.0.0" }] }
    });

    // Get info about the new container
    var containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();

    // Determine what port the new container was mapped to
    var port = containerInfo.HostConfig.PortBindings["8080/tcp"][0].HostPort;

    // Update info in AI document
    AppInstances.update({_id: instanceId}, {
      $set: {
        containerId: containerInfo.Id,
        port: port,
        dockerHosts: [hostDoc._id]
      }
    });

    ContainerActions.getInfo(instanceId);

    return true;
  }
};