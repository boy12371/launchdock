/*
 * Methods related to app instances: prefix with "ai/"
 */

Meteor.methods({
  /*
  * launch app instance
  */
  'ai/launch': function (options) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    options = options || {};
    if (typeof options.appImage !== "string") {
      throw new Meteor.Error(400, 'Bad request', "You must pass the appImage option set to the string name of the docker image to use.");
    }
    // Create a new app instance record
    var newInstanceId = AppInstances.insert({
      image: options.appImage,
      hostnames: options.hostnames,
      env: options.env || {},
      config: options.config || {}
    });
    // check that image exists, and if not pull it
    // this is not the best approach, as we're not waiting for it.
    // but will at least fix second attempts.
    Meteor.call('image/exists', options.appImage, function(error,result) {
      console.log(options.appImage);
      var record = DockerImages.findOne({'name': options.appImage});
      if (result == true && record) {
        // Run and attach a new docker container for it
        ContainerActions.addForAppInstance(newInstanceId);
      } else {
        Meteor.call('image/add', options.appImage, function (error,result) {
          // Run and attach a new docker container for it
          ContainerActions.addForAppInstance(newInstanceId);
        });
      }
    });
    // Return the app instance ID for use in future calls; calling app should store this somewhere
    return newInstanceId;
  },
  // Deactivate and then reactivate. End result is a new container,
  // potentially on a different host, and potentially with a newer
  // version of the image.
  'ai/rebuild': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Rebuilding: ",instanceId);
    ContainerActions.removeForAppInstance(instanceId);
    ContainerActions.addForAppInstance(instanceId);
    return true;
  },
  'ai/rebuildAll': function () {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    console.log("Rebuilding all...");
    AppInstances.find().forEach(function (ai) {
      Meteor.call("ai/rebuild", ai._id);
    });

    return true;
  },
  'ai/restart': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Restarting: ",instanceId);
    var container = ContainerActions.getForAppInstance(instanceId);
    if (!container) {
      Meteor.call('ai/rebuild', instanceId)
      return true;
    }
    // Restart container
    result = Meteor.wrapAsync(container.restart.bind(container))();
    if (!result) {
      ContainerActions.updateProxy(instanceId);
      return true;
    } else {
      return result;
    }
  },
  'ai/start': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Starting: ",instanceId);
    var container = ContainerActions.getForAppInstance(instanceId);

    if (!container) {
      Meteor.call('ai/rebuild', instanceId)
      return true;
    }
    // Start container
    Meteor.wrapAsync(container.start.bind(container))();
    // update container info
    ContainerActions.getInfo(instanceId);
    return true;
  },
  'ai/stop': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Stopping: ",instanceId);
    var container = ContainerActions.getForAppInstance(instanceId);

    if (!container)  {
      AppInstances.update({'_id':instanceId}, {$set:{'status':'stopped'}});
      console.log("Container for "+instanceId+"not found. Marking stopped.")
      return true;
    }
    // Stop container
    try {
      Meteor.wrapAsync(container.stop.bind(container))();
    } catch (e) {
      AppInstances.update({'_id':instanceId}, {$set:{'status':'stopped'}});
      console.log("Container invalid for "+instanceId+". Marking stopped.")
      return true;
    }

    ContainerActions.getInfo(instanceId);
    return true;
  },
  'ai/kill': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Killing: ",instanceId);
    var container = ContainerActions.getForAppInstance(instanceId);

    if (!container)  {
      AppInstances.update({'_id':instanceId}, {$set:{'status':'stopped'}});
      console.log("Container for "+instanceId+"not found. Marking stopped.")
      return true;
    }

    // Kill container
    try {
      Meteor.wrapAsync(container.kill.bind(container))();
    } catch (e) {
      AppInstances.update({'_id':instanceId}, {$set:{'status':'stopped'}});
      console.log("Container invalid for "+instanceId+". Marking stopped.")
      return true;
    }

    ContainerActions.getInfo(instanceId);
    return true;
  },
  'ai/remove': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Removing: ",instanceId);
    ContainerActions.removeForAppInstance(instanceId);

    // Remove app instance from collection
    if (AppInstances.remove({_id: instanceId}) === 0) {
      throw new Meteor.Error(500, 'Internal server error', "Failed to remove app instance with ID " + instanceId);
    }

    HostActions.updateAll();
    return instanceId;
  },
  // Kills, removes, and detaches the docker container, but keeps
  // the app instance record. Can be "activated" later by
  // starting a new container.
  'ai/deactivate': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Deactivating: ",instanceId);
    ContainerActions.removeForAppInstance(instanceId);

    HostActions.updateAll();
    return true;
  },
  // Starts a new container for the instance. Only works if there
  // is not already one listed (i.e., it is deactivated).
  'ai/activate': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Activating: ",instanceId);
    ContainerActions.addForAppInstance(instanceId);

    HostActions.updateAll();
    return true;
  },
  'ai/getEnvironmentVariables': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);

    var ai = AppInstances.findOne({_id: instanceId});
    return ai && ai.env;
  },
  'ai/addHostname': function (instanceId, hostname) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    check(hostname, String);
    console.log("Add hostname: ",instanceId, hostname);
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
    // Map all exposed ports to hipache entry
    _.each(ai.info.NetworkSettings.Ports, function (exposedPort) {
      _.each(exposedPort, function(port) {
        Hipache.rpush('frontend:'+hostname, "http://"+dockerHost.publicHost+":"+port.HostPort);
      });
    });
    return true;
  },
  'ai/removeHostname': function (instanceId, hostname) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
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
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);

    return ContainerActions.getInfo(instanceId);
  }
});

ContainerActions = {
  // Returns a docker container object for the container that is running the
  // given app instance
  getForAppInstance: function getForAppInstance(instanceId, docker) {
    var ai = AppInstances.findOne({_id: instanceId});
    if (typeof ai === 'undefined') return null;
    if (!ai.info.Id && ai.containerId) ai.info.Id = ai.containerId; //backwards compat, we now store all info.
    if (!ai.info.Id) return null;

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
    var containers = Meteor.wrapAsync(docker.listContainers.bind(docker))({all: 1});
    var exists = _.any(containers, function (container) {
      return container.Id === ai.info.Id;
    });

    return exists ? docker.getContainer(ai.info.Id) : null;
  },
  //***
  //  return container info
  //***
  getInfo: function getInfo(instanceId) {
    var container = ContainerActions.getForAppInstance(instanceId);
    if (!container)
      return null;

    var info = Meteor.wrapAsync(container.inspect.bind(container))();
    // Update app instance doc with some actual container info
    AppInstances.update({_id: instanceId}, {$set: {
      info: info,
      status: (info.State && info.State.Running) ? "running" : "stopped",
      'container.pid': info.State && info.State.Pid
    }});

    // Return container info
    return info;
  },
  updateInfoForAll: function updateContainerInfoForAllAppInstances() {
    AppInstances.find({'info.Id': {$exists: true, $ne: null}}).forEach(function (appInstance) {
      ContainerActions.getInfo(appInstance._id);
    });
  },
  updateProxy: function updateProxy(instanceId) {
    // make sure info is current first.
    ContainerActions.getInfo(instanceId);
    var ai = AppInstances.findOne({_id: instanceId});
    // Update proxy server host records
    if (ai.hostnames) {
      if (ai.hostnames[0]) Meteor.call("ai/removeHostname", ai._id, ai.hostnames[0]);
      // If hostname is provided, add domain to hipache as a group.
      Meteor.call("ai/addHostname", ai._id, ai.hostnames[0]);
    } else if (ai.env.ROOT_URL) {
      Meteor.call("ai/addHostname", ai._id, ai.env.ROOT_URL.substr(ai.env.ROOT_URL.indexOf('://')+3));
    }
    // Make sure all info is refreshed.
    ContainerActions.getInfo(instanceId);
  },
  removeForAppInstance: function removeForAppInstance(instanceId, skipDocker) {
    var ai = AppInstances.findOne({_id: instanceId});

    if (!ai)
      return false;

    // Unregister all hostnames from the proxy server since
    // they point to the container being removed.
    _.each(ai.hostnames, function (hostname) {
      console.log("Removing hipache entry:" + hostname);
      Hipache.del("frontend:"+hostname)
    });

    // We remove the docker container if we have one, otherwise ignore it
    if (skipDocker !== true) {
      var container = ContainerActions.getForAppInstance(instanceId);
      if (container) {
        // Kill container
        Meteor.wrapAsync(container.kill.bind(container))();

        // Remove container
        Meteor.wrapAsync(container.remove.bind(container))();
      }
    }

    // Remove container ID from AI record
    AppInstances.update({_id: instanceId}, {
      $unset: {
        containerId: "",
        container: "",
        info: "",
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

    var docker = DockerActions.get({host: hostDoc.privateHost, port: hostDoc.port});
    if (!docker)
      return false;

    // Prep env variables
    var dockerEnv = _.map(ai.env, function (val, key) {
      return key + '=' + val;
    });

    // config can be passed into launch option.config and will add/override to defaults
    config = ai.config || {};
    if (!config.name && config.Hostname) config.name = config.Hostname;
    if (!config.HostConfig) config.HostConfig = {};
    if (!config.Image) config.Image = ai.image;
    if (!config.Env) config.Env = dockerEnv;
    if (!config.ExposedPorts && !config.HostConfig.PublishAllPorts) config.HostConfig.PublishAllPorts = true;
    // Create a new container
    var container = Meteor.wrapAsync(docker.createContainer.bind(docker))(config);
    // Start container
    Meteor.wrapAsync(container.start.bind(container))();
    // Get info about the new container
    var containerInfo = Meteor.wrapAsync(container.inspect.bind(container))();
    // Update info in AI document
    AppInstances.update({_id: instanceId}, {
      $set: {
        containerId: containerInfo.Id,
        dockerHosts: [hostDoc._id],
        info: containerInfo
      }
    });
    // Update proxy server host records
    if (ai.hostnames) {
      if (ai.hostnames[0]) Meteor.call("ai/removeHostname", ai._id, ai.hostnames[0]);
      // If hostname is provided, add domain to hipache as a group.
      Meteor.call("ai/addHostname", ai._id, ai.hostnames[0]);
    } else if (ai.env.ROOT_URL) {
      Meteor.call("ai/addHostname", ai._id, ai.env.ROOT_URL.substr(ai.env.ROOT_URL.indexOf('://')+3));
    }
    ContainerActions.getInfo(instanceId);
    return true;
  }
};
