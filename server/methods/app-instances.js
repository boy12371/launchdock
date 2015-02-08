/*
 * Methods related to app instances: prefix with "ai/"
 */

Meteor.methods({
  /*
  * launch app instance
  */
  'ai/launch': function (options) {
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
    image =  options.appImage;
    var exists = Meteor.call('image/exists', image);
    var record = DockerImages.findOne({'name': image});
    if (exists != true || !record) {
      console.log("Image not found:" + image);
      Meteor.call('image/add', image);
    }
    // Run and attach a new docker container for it
    ContainerActions.addForAppInstance(newInstanceId);
    console.log("launched new " + options.appImage + " instance "+ newInstanceId);
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

    try {
      ContainerActions.removeForAppInstance(instanceId);
      ContainerActions.addForAppInstance(instanceId);
    }
    catch(err) {
      console.log("No application instance record found.");
      return false
    }
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
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Restarting: " + instanceId);
    var container = ContainerActions.getForAppInstance(instanceId);
    if (!container) {
      console.log("No container found, attempting rebuild:  " + instanceId);
      try {
        ContainerActions.removeForAppInstance(instanceId);
        ContainerActions.addForAppInstance(instanceId);
      }
      catch(err) {
        console.log("No application instance record found.");
        return false, err
      }
      return true;
    }
    // Restart container
    Meteor.wrapAsync(container.restart.bind(container))();
    ContainerActions.getInfo(instanceId);
    Meteor.call("ai/addHostname", instanceId);
    return true;
  },
  'ai/start': function (instanceId) {
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    console.log("Starting: ",instanceId);
    var container = ContainerActions.getForAppInstance(instanceId);

    if (!container) {
      return Meteor.call('ai/rebuild', instanceId)
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
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    // get the appinstance
    var ai = AppInstances.findOne({_id: instanceId});
    // if host is passed as a param, we'll add it
    // if host has been assigned, let's remove it from hipache
    // if a host hasn't been assigned we'll get one.
    // pass ROOT_URL has a env variable or
    // we'll get from Docker container settings (domainName, Hostname, Name)
    if (!hostname) {
      if (ai.hostnames) {
        hostname = ai.hostnames[0];
      }
      if(!hostname) {
        if (ai.env.ROOT_URL) {
          hostname = ai.env.ROOT_URL.substr(ai.env.ROOT_URL.indexOf('://')+3);
        } else {
          hostname = ai.config.domainName || ai.config.Domainname || ai.config.Hostname || ai.config.Name;
        }
      }
    }
    console.log("Add hostname: ",instanceId, hostname);
    // A hostname may only be mapped to one app instance
    // Note this hostname in the AppInstance info
    var existing = AppInstances.findOne({hostnames: { $ne: hostname}, _id: instanceId});
    if (existing) {
      console.log("Adding additonal hostname for the app instance with ID :" + existing._id);
      AppInstances.update({_id: instanceId}, {$push: {hostnames: hostname}});
    } else {
      AppInstances.update({_id: instanceId}, {$set: {hostnames: [hostname]}});
    }
    // Inform the proxy server that it needs to route the provided hostname to the provided instance
    // use domain prefix as unique identifier for the proxy server
    if (hostname.split(".").length > 2) {
      var domainId = hostname.split(".")[0];
    } else {
      var domainId = Random.id(8);
    }
    // collection helper to get hosts
    var dockerHosts = ai.hosts();
    if (!dockerHosts.length) {
      console.log("Can't add hostname because app instance " + instanceId + " does not have dockerHosts listed.");
      return false;
    }
    var dockerHost = dockerHosts[0];
    Meteor.wrapAsync(Redis.rpush.bind(Redis))('frontend:'+hostname, domainId );
    // PORT set as ENV variable in container
    // will make that the only port mapped.
    if (ai.env.PORT) {
      var portKey = ai.env.PORT+"/tcp"; // map to tcp
      var port = ai.info.NetworkSettings.Ports[portKey][0];

      console.log("frontend:"+hostname, "http://"+dockerHost.publicHost+":"+port.HostPort)
      Meteor.wrapAsync(Redis.rpush.bind(Redis))('frontend:'+hostname, "http://"+dockerHost.publicHost+":"+port.HostPort);

    } else {
      // else map all exposed ports to hipache entry,
      console.log("Mapping Port(s):" + networkPorts);
      _.each(ai.info.NetworkSettings.Ports, function (exposedPort) {
        _.each(exposedPort, function(port) {
          console.log("frontend:"+hostname, "http://"+dockerHost.publicHost+":"+port.HostPort)
          Meteor.wrapAsync(Redis.rpush.bind(Redis))('frontend:'+hostname, "http://"+dockerHost.publicHost+":"+port.HostPort);
        });
      });
    }

    return true;
  },
  'ai/removeHostname': function (instanceId, hostname) {
    Utility.checkLoggedIn(Meteor.userId());
    check(instanceId, String);
    check(hostname, String);

    // Remove this hostname from the AppInstance info
    AppInstances.update({_id: instanceId}, {$pull: {hostnames: hostname}});

    // Inform the proxy server that it no longer needs to route the provided hostname to the provided instance
    Meteor.wrapAsync(Redis.del.bind(Redis))("frontend:"+hostname)

    return true;
  },
  'ai/getContainerInfo': function (instanceId) {
    this.unblock();
    // console.log("checking status: " + instanceId)
    check(instanceId, String);
    try {
      Utility.checkLoggedIn(Meteor.userId());
      return ContainerActions.getInfo(instanceId);
    }
    catch (error) {
      console.log("Error getting container info: ", instanceId);
      return null
    }

  }
});

ContainerActions = {
  //
  // Returns a docker container object for the container that is running the given app instance
  //
  getForAppInstance: function getForAppInstance(instanceId, docker) {
    var ai = AppInstances.findOne({_id: instanceId});
    if (typeof ai === 'undefined') return null;
    if (!ai.dockerHosts) return null;
    var docker = docker || DockerActions.getForHost(ai.dockerHosts[0]);
    if (!docker) {
      return null;
    }
    // Are there actually any containers on this docker instance with this container ID?
    var containers = Meteor.wrapAsync(docker.listContainers.bind(docker))({all: 1});
    var exists = _.any(containers, function (container) {
      return container.Id === ai.containerId;
    });

    return exists ? docker.getContainer(ai.containerId) : null;
  },
  //
  //  return container info, update AppInstances
  //
  getInfo: function getInfo(instanceId) {
    var container = ContainerActions.getForAppInstance(instanceId);
    if (!container) {
      AppInstances.update({_id: instanceId}, {$set: {
        'info': "",
        'status': "stopped",
        'container.pid': ""
      }});
      return null;
    };
    var info = Meteor.wrapAsync(container.inspect.bind(container))();
    // Update app instance doc with some actual container info
    AppInstances.update({_id: instanceId}, {$set: {
      'info': info,
      'status': (info.State && info.State.Running) ? "running" : "stopped",
      'container.pid': info.State && info.State.Pid
    }});
    // Return container info
    return info;
  },
  //
  // will loop through all AppInstance and update their info
  //
  updateInfoForAll: function updateContainerInfoForAllAppInstances() {
    AppInstances.find({'info.Id': {$exists: true, $ne: null}}).forEach(function (appInstance) {
      ContainerActions.getInfo(appInstance._id);
    });
  },
  //
  // remove container and unset AppInstance info
  //
  removeForAppInstance: function removeForAppInstance(instanceId, skipDocker) {
    var ai = AppInstances.findOne({_id: instanceId});
    if (!ai) return false;
    // Unregister all hostnames from the proxy server since
    // they point to the container being removed.
    _.each(ai.hostnames, function (hostname) {
      console.log("Removing hipache entry:" + hostname);
      Redis.del("frontend:"+hostname)
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
    // refresh info
    ContainerActions.getInfo(instanceId);
    return true;
  },
  //
  // add new container for defined instance
  // save configuration to AppInstances collection
  // update proxy
  //
  addForAppInstance: function addForAppInstance(instanceId) {
    check(instanceId, String);
    var ai = AppInstances.findOne({_id: instanceId});
    console.log("Add container for app instance: "+ ai.instanceId);
    //Bad instanceId

    if (!ai) {
      console.log("addForAppInstance failed: no existing app instance.")
      return false;
    }
    //Already has a container running (but we need this to get a new one)
    if (ai.containerId) {
      return true;
    }
    // Prep env variables
    var dockerEnv = _.map(ai.env, function (val, key) {
      return key + '=' + val;
    });
    // get new docker host (will assign ai.dockerHosts and return docker host)
    var docker = DockerActions.getForAppInstance(instanceId);
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
    var started = Meteor.wrapAsync(container.start.bind(container))();
    // Get info about the new container
    var info = Meteor.wrapAsync(container.inspect.bind(container))();
    // Final Update info in AI document
    AppInstances.update({_id: instanceId}, {
      $set: {
        'containerId': info.Id,
        'info': info,
        'container.pid': info.State && info.State.Pid,
        'status': (info.State && info.State.Running) ? "running" : "stopped"
      }
    });
    // Update proxy server host records
    Meteor.call("ai/addHostname", instanceId);
    return info;
  }
};
