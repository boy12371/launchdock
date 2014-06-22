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

    // Prepare environment variables
    var env = options.env;
    var dockerEnv = _.map(env, function (val, key) {
      return key + '=' + val;
    });

    // Determine the best host and get a Docker instance for it
    var hostDoc = HostActions.getBest();
    if (hostDoc) {
      var docker = DockerActions.get(hostDoc.privateHost, hostDoc.port);
    } else {
      var docker = DockerActions.get();
    }

    // Create a new container
    var container = Meteor._wrapAsync(docker.createContainer.bind(docker))({
      Image: options.appImage,
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

    // Get the container's ID
    var containerId = containerInfo.ID;

    // Determine what port the new container was mapped to
    var port = containerInfo.HostConfig.PortBindings["8080/tcp"][0].HostPort;

    // Create a new app instance record
    var newInstance = AppInstances.insert({
      port: port,
      image: options.appImage,
      containerId: containerId,
      status: containerInfo.State.Running ? "running" : "stopped",
      env: env,
      dockerHosts: [hostDoc._id]
    });
    if (options.hostname) {
      //if hostname is provided, add domain to hipache as a group.
      // new: domain.reactioncommerce.com  domain
      Meteor.call("ai/addHostname", newInstance, options.hostname);
    }
    HostActions.updateAll();
    ContainerActions.getInfo(newInstance);
    // Return the app instance ID for use in future calls; calling app should store this somewhere
    return newInstance;
  },
  // Kill this app instance after cloning it to a new docker container
  'ai/rebuild': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    var ai = AppInstances.findOne({_id: instanceId});
    var dockerHosts = ai.dockerHosts;
    if (!dockerHosts.length) {
      console.log("Can't rebuild because app instance " + instanceId + " does not have dockerHosts listed.");
      return false;
    }

    // Currently an app instance runs on only one host
    var docker = DockerActions.getForHost(dockerHosts[0]);

    var options = {
      env: ai.env,
      appImage: ai.image
    };

    console.log("rebuilding instance: "+instanceId);
    // Stop any existing container and start new.
    try {
      Meteor.call("ai/kill", instanceId);
    }
    catch(err) {
      console.log("No existing instance. launching new container: "+options.appImage);
    }

    var cloneId = Meteor.call("ai/launch", options);

    // loop through hostnames and add additional hostnames from original
    if (ai.hostnames && ai.hostnames.length) {
      var hn = ai.hostnames[0];
      Meteor.call("ai/removeHostname", instanceId, hn);
      Meteor.call("ai/addHostname", cloneId, hn);
    }

    // Remove old container
    try {
      Meteor.call("ai/remove", instanceId);
    }
    catch(err) {
      console.log("No existing instance.");
    }

    console.log("created: "+cloneId);
    return cloneId;
  },
  'ai/restart': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = ContainerActions.getForAppInstance(instanceId);

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

    // Kill container
    Meteor._wrapAsync(container.kill.bind(container))();

    ContainerActions.getInfo(instanceId);
    return true;
  },
  'ai/remove': function (instanceId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    check(instanceId, String);

    var docker = DockerActions.getForAppInstance(instanceId);
    var ai = AppInstances.findOne({_id: instanceId});
    var containerId = ai.containerId;

    // Are there actually any containers on this docker instance with this container ID?
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
      Meteor.call("ai/removeHostname", instanceId, hostname);
    });

    // Remove app instance from collection
    if (AppInstances.remove({_id: instanceId}) === 0) {
      throw new Meteor.Error(500, 'Internal server error', "Failed to remove app instance with ID " + instanceId);
    }

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
    docker = docker || DockerActions.getForAppInstance(instanceId);
    var ai = AppInstances.findOne({_id: instanceId});
    return docker.getContainer(ai.containerId);
  },
  getInfo: function getInfo(instanceId) {
    var container = ContainerActions.getForAppInstance(instanceId);
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
    AppInstances.find().forEach(function (appInstance) {
      ContainerActions.getInfo(appInstance._id);
    });
  }
};