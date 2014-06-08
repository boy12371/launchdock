Meteor.methods({
  addHost: function(privateHost, publicHost, port, max, active) {
    this.unblock();
    checkLoggedIn(this.userId);

    Hosts.insert({privateHost: privateHost, publicHost: publicHost, port: port, max: max, active: active});
    listenToDockerEvents(privateHost, port);
    return true;
  },
  // update host details
  updateHostDetails: function () {
    this.unblock();
    checkLoggedIn(this.userId);

    return updateHostDetails();
  },
  // get host details
  getHostDetail: function (hostId) {
    this.unblock();
    checkLoggedIn(this.userId);

    var host = Hosts.findOne(hostId);
    return getHostInfo(host);
  },
  // kill and rebuild app container
  rebuildAppInstance: function (instanceId) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);

    var ai = AppInstances.findOne({_id: instanceId});
    if (ai.docker.host) {
      var docker = getDocker(ai.docker.host, ai.docker.port);
    } else {
      var docker = getDocker(ai.host,ai.docker.port);
    }

    var options = {};
    options.email = ai.env.METEOR_EMAIL;
    options.rootUrl = ai.env.ROOT_URL;
    options.mongoUrl = ai.env.MONGO_URL;
    options.appImage = ai.image;

    console.log("rebuilding instance: "+instanceId);
    // Stop any existing container and start new.
    try {
      Meteor.call("killAppInstance", instanceId);
      Meteor.call("removeAppInstance", instanceId);
    }
    catch(err) {
      console.log("No existing instance. launching new container: "+options.appImage)
    }

    cloneId = Meteor.call("launchAppInstance", options);

    // loop through hostnames and add additional hostnames from original
    if (ai.hostnames) {
      options.hostname = ai.hostnames[0];
      Meteor.call("removeHostname", instanceId, options.hostname);
      Meteor.call("addHostname", cloneId, options.hostname);
    }

    console.log("created: "+cloneId);
    return cloneId
  },
  // create new app container, setup proxy
  launchAppInstance: function (options) {
    this.unblock();
    checkLoggedIn(this.userId);

    options = options || {};

    var docker = getDockerHost();

    if (typeof options.appImage !== "string") {
      throw new Meteor.Error(400, 'Bad request', "You must pass the appImage option set to the string name of the docker image to use.");
    }

    if (typeof options.mongoUrl !== "string") {
      throw new Meteor.Error(400, 'Bad request', "You must pass the mongoUrl option set to the MongoDB URL for the app instance's database.");
    }

    if (typeof options.rootUrl !== "string") {
      throw new Meteor.Error(400, 'Bad request', "You must pass the rootUrl option set to the desired root URL for the app instance.");
    }

    // public host for sites
    var hostDoc = Hosts.findOne({privateHost:docker.modem.host});
    var host = hostDoc ? hostDoc.publicHost : '127.0.0.1';

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
      host: host,
      port: port,
      image: options.appImage,
      containerId: containerId,
      createdAt: new Date,
      status: containerInfo.State.Running ? "running" : "stopped",
      env: env,
      docker: docker.modem,
      dockerHosts: [hostDoc._id]
    });
    if (options.hostname) {
      //if hostname is provided, add domain to hipache as a group.
      // new: domain.reactioncommerce.com  domain
      Meteor.call("addHostname", newInstance, options.hostname);
    }
    updateHostDetails();
    // Return the app instance ID for use in future calls; calling app should store this somewhere
    return newInstance;
  },
  restartAppInstance: function (instanceId) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = getContainerForAppInstance(instanceId);

    // Restart container
    Meteor._wrapAsync(container.restart.bind(container))();

    return true;
  },
  startAppInstance: function (instanceId) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = getContainerForAppInstance(instanceId);

    // Start container
    Meteor._wrapAsync(container.start.bind(container))({
      "PortBindings": { "8080/tcp": [{ "HostIp": "0.0.0.0" }] }
    });

    return true;
  },
  stopAppInstance: function (instanceId) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = getContainerForAppInstance(instanceId);

    // Stop container
    return Meteor._wrapAsync(container.stop.bind(container))();
  },
  killAppInstance: function (instanceId) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = getContainerForAppInstance(instanceId);

    // Kill container
    return Meteor._wrapAsync(container.kill.bind(container))();
  },
  removeAppInstance: function (instanceId) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);

    var docker = getDockerForAppInstance(instanceId);
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
      Meteor.call("removeHostname", instanceId, hostname);
    });

    // Remove app instance from collection
    if (AppInstances.remove({_id: instanceId}) === 0) {
      throw new Meteor.Error(500, 'Internal server error', "Failed to remove app instance with ID " + instanceId);
    }

    updateHostDetails();
    return true;
  },
  getEnvironmentVariables: function (instanceId) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);

    var ai = AppInstances.findOne({_id: instanceId});
    return ai && ai.env;
  },
  addHostname: function (instanceId, hostname) {
    this.unblock();
    checkLoggedIn(this.userId);
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
    Hipache.rpush('frontend:'+hostname, ai.host+":"+ai.port);
    return true;
  },
  removeHostname: function (instanceId, hostname) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);
    check(hostname, String);

    // Remove this hostname from the AppInstance info
    AppInstances.update({_id: instanceId}, {$pull: {hostnames: hostname}});

    // Inform the proxy server that it no longer needs to route the provided hostname to the provided instance
    Hipache.del("frontend:"+hostname)

    return true;
  },
  addImage: function (imageName) {
    this.unblock();
    checkLoggedIn(this.userId);

    try {
      var imageId = DockerImages.insert({
        name: imageName,
        inRepo: true
      });
    } catch (e) {
      throw new Meteor.Error(400, 'Bad Request', 'An image with that name already exists.');
    }

    createImageOnAllHosts(imageId);
    return true;
  },
  removeImage: function (imageId) {
    this.unblock();
    checkLoggedIn(this.userId);

    removeImageOnAllHosts(imageId);
    DockerImages.remove({_id: imageId});
    
    return true;
  },
  addImageFromArchive: function (imageName, archiveUrl) {
    this.unblock();
    checkLoggedIn(this.userId);

    try {
      var imageId = DockerImages.insert({
        name: imageName,
        inRepo: false,
        tarUrl: archiveUrl
      });
    } catch (e) {
      throw new Meteor.Error(400, 'Bad Request', 'An image with that name already exists.');
    }

    createImageOnAllHosts(imageId);
    return true;
  },
  createImageOnAllHosts: function (imageId) {
    createImageOnAllHosts(imageId);
    return true;
  },
  getImageListForHost: function (hostId) {
    var docker = getDockerForHost(hostId);
    var imageList = Meteor._wrapAsync(docker.listImages.bind(docker))();
    var dockerImages = _.map(imageList, function (image) {
      return {
        name: image.RepoTags && image.RepoTags[0] && image.RepoTags[0].split(":")[0] || "None",
        id: image.Id,
        createdAt: new Date(image.Created * 1000),
        virtualSize: image.VirtualSize
      };
    });
    Hosts.update({_id: hostId}, {$set: {
      dockerImages: dockerImages
    }});
    return imageList;
  },
  getContainerInfo: function (instanceId) {
    this.unblock();
    checkLoggedIn(this.userId);
    check(instanceId, String);

    var container = getContainerForAppInstance(instanceId);

    // Return container info
    return Meteor._wrapAsync(container.inspect.bind(container))();
  }
});

// WORK IN PROGRESS
function buildImageFromGitRepo(gitUrl) {
  // Create a temp directory for this bundle
  var tempBundleDir = path.join(os.tmpdir(), Random.id());
  Utility.ensureDir(tempBundleDir);

  // Git clone into the temp dir
  // TODO use git-node pkg?

  // Copy the Dockerfile into the bundle temp dir
  fs.writeFileSync(path.join(tempBundleDir, 'Dockerfile'), fs.readFileSync(path.join(serverDir, 'assets/app/Dockerfile')));

  // Build image from local path
  // var tarFile = ? // TODO need to bundle local path into tar.gz
  //Meteor._wrapAsync(docker.buildImage.bind(docker))(tarFile, {t: imageName, rm: 1});
}

// Pull a docker image from repo on a single host, if an image with that name
// does not already exist on that host.
function pullImageOnHost(host, port, repoTag) {
  var docker = getDocker(host, port);

  // If it already exists, no need to pull
  var images = Meteor._wrapAsync(docker.listImages.bind(docker))();
  var exists = _.any(images, function (image) {
    return image.RepoTags && _.contains(image.RepoTags, repoTag);
  });
  if (exists) return;

  try {
    Meteor._wrapAsync(docker.pull.bind(docker))(repoTag);
  } catch (error) {
    throw new Meteor.Error(500, 'Internal server error', "Error pulling image: " + (error && error.message ? error.message : 'Unknown'));
  }
}

// Build a docker image from a tar on a single host, if an image with that name
// does not already exist on that host.
function buildImageOnHost(host, port, imageName, archiveUrl) {
  var docker = getDocker(host, port);

  // If it already exists, no need to pull
  var images = Meteor._wrapAsync(docker.listImages.bind(docker))();
  var exists = _.any(images, function (image) {
    return image.RepoTags && _.contains(image.RepoTags, imageName + ":latest");
  });
  if (exists) return;

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
}

// Create (pull or build) the docker image on all hosts if not already existing
function createImageOnAllHosts(imageId) {
  var image = DockerImages.findOne(imageId);
  if (!image)
    throw new Meteor.Error(500, 'Internal server error', "Invalid image ID");

  if (!image.inRepo && image.tarUrl) {
    var imageName = image.name;
    var archiveUrl = image.tarUrl;
    Hosts.find().forEach(function (host) {
      buildImageOnHost(host.privateHost, host.port, imageName, archiveUrl);
    });
  } else if (image.inRepo) {
    var repoTag = image.name + ":latest";
    Hosts.find().forEach(function (host) {
      pullImageOnHost(host.privateHost, host.port, repoTag);
    });
  }
}

// Remove the docker image from all hosts
function removeImageOnAllHosts(imageId) {
  var image = DockerImages.findOne(imageId);
  if (!image)
    throw new Meteor.Error(500, 'Internal server error', "Invalid image ID");

  var imageName = image.name;
  Hosts.find().forEach(function (host) {
    var docker = getDocker(host.privateHost, host.port);
    var dockerImage;
    var images = Meteor._wrapAsync(docker.listImages.bind(docker))();
    _.every(images, function (image) {
      if (image.RepoTags && _.contains(image.RepoTags, imageName + ":latest")) {
        dockerImage = docker.getImage(image.Id);
        return false;
      }
    });

    if (dockerImage) {
      Meteor._wrapAsync(dockerImage.remove.bind(dockerImage))();
    }
  });
}

function getHostInfo(host) {
  var docker = getDocker(host.privateHost, host.port);
  var info = Meteor._wrapAsync(docker.info.bind(docker))();
  // Update in Hosts document while we have it
  Hosts.update(host._id, {$set:{details:info}});
  return info;
}

// Check live docker host information and save to hosts db
function updateHostDetails() {
  Hosts.find().forEach(function (host) {
    getHostInfo(host);
  });
}

// Return docker connection for the host that has the fewest containers
function getDockerHost() {
  updateHostDetails();
  target = Hosts.findOne({}, {sort: {'details.Containers': 1}});
  if (target) {
    return getDocker(target.privateHost, target.port);
  } else {
    return getDocker();
  }
}

function getDockerForHost(hostId) {
  var target = Hosts.findOne(hostId);
  if (!target)
    throw new Meteor.Error(400, 'Bad request', "No defined docker host has ID " + hostId);
  return getDocker(target.privateHost, target.port);
}

// Returns a docker object for the server that is running the
// given app instance's container
function getDockerForAppInstance(instanceId) {
  var ai = AppInstances.findOne({_id: instanceId});
  if (!ai)
    throw new Meteor.Error(400, 'Bad request', "No app instance has ID " + instanceId);
  return getDocker(ai.docker.host, ai.docker.port);
}

// Returns a docker container object for the container that is running the
// given app instance
function getContainerForAppInstance(instanceId, docker) {
  docker = docker || getDockerForAppInstance(instanceId);
  return docker.getContainer(ai.containerId);
}

function checkLoggedIn(userId) {
  if (!userId)
    throw new Meteor.Error(401, "Access Denied");
}