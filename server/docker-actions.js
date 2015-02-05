DockerActions = {
  // Get docker connection for host/port/protocol or for local server as fallback
  // read in docker certificates
  get: function getDocker(dockerHost) {
    if (!dockerHost) return null;
    // read SSL certificates, path and cert customizable in Meteor.setttings.dockerSSL
    if ((Meteor.settings.dockerSSL || process.env.DOCKER_TLS_VERIFY == 1) && !dockerHost.socketPath) {
      if (!dockerHost.protocol) dockerHost.protocol = "https";
      if (dockerHost.protocol == "https") {
        var certPath = Meteor.settings.dockerSSL.path || process.env.DOCKER_CERT_PATH;
        var ca = Meteor.settings.dockerSSL.ca || "ca.pem";
        var cert = Meteor.settings.dockerSSL.cert || "cert.pem";
        var key = Meteor.settings.dockerSSL.key || "key.pem"
        dockerHost.ca = fs.readFileSync(certPath + "/" + ca);
        dockerHost.cert = fs.readFileSync(certPath + "/" + cert);
        dockerHost.key = fs.readFileSync(certPath + "/" + key);
      }
    }
    if (!dockerHost.protocol && !dockerHost.socketPath) dockerHost.protocol = "http";
    if (!dockerHost.timeout) dockerHost.timeout = 2000;

    var d = new Docker(dockerHost);
    // Make sure the instance is up; TODO should probably do something
    // simple like a ping instead. Not sure if docker has connection test endpoint.
    try {
      Meteor.wrapAsync(d.info.bind(d))();
    } catch (error) {
      console.log("Error connection to docker: " + error);
      d = null;
    }
    return d;
  },
  getForHost: function getDockerForHost(hostId) {
    var target = Hosts.findOne(hostId);
    if (!target)
      throw new Meteor.Error(400, 'Bad request', "No defined docker host has ID " + hostId);
    return DockerActions.get({host: target.privateHost, port: target.port, protocol: target.protocol});
  },
  // Returns a docker object for the server that is running the
  // given app instance's container
  // sets the dockerHost value in instance record
  getForAppInstance: function getForAppInstance(instanceId) {
    var ai = AppInstances.findOne({_id: instanceId});
    if (!ai)
      throw new Meteor.Error(400, 'Bad request', "No app instance has ID " + instanceId);
    var dockerHosts = ai.dockerHosts;
    // Check that hosts are valid and exist
    // if the host isn't valid we'll give a new host to the instance
    if (dockerHosts) {
      if (Hosts.find({_id: dockerHosts[0]}, {limit: 1}).count() !== 1) {
        dockerHosts = null;
      }
    }
    // if there isn't a dockerHost assigned let's find and assign
    if (!dockerHosts || !dockerHosts.length) {
      var hostDoc = HostActions.getBest();
      if (!hostDoc) {
        console.log("DockerActions: No valid docker hosts found. Cannot add for instance: " + instanceId);
        throw new Meteor.error(400, 'No valid hosts. Cannot add for instance: ' + instanceId);
      }
      // connect to docker host
      var docker = DockerActions.get({host: hostDoc.privateHost, port: hostDoc.port, protocol: hostDoc.protocol});
      if (!docker) {
        console.log("DockerActions: Unable to connect to docker host on " + hostDoc.protocol + "://" + hostDoc.privateHost + ":" + hostDoc.port);
        return null;
      }
      // Update info in AI document
      AppInstances.update({_id: instanceId}, {
        $set: {
          dockerHosts: [hostDoc._id]
        }
      });
      dockerHosts = [hostDoc._id];
    }
    // Currently each app instance runs on only one host
    // TODO: support multiple hosts
    return DockerActions.getForHost(dockerHosts[0]);
  }
};
