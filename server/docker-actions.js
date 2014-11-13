DockerActions = {
  // Get docker connection for host/port or for local server as fallback
  get: function getDocker(dockerHost) {
    if (!dockerHost) return null;
    if (!dockerHost.protocol && !dockerHost.socketPath) dockerHost.protocol = "tcp";
    if (!dockerHost.timeout) dockerHost.timeout = 500;
    // read SSL certificates, path and cert customizable in Meteor.setttings.dockerSSL
    if (Meteor.settings.dockerSSL && process.env.DOCKER_TLS_VERIFY == 1 ) {
      dockerHost.protocol = "https";
      var certPath = Meteor.settings.dockerSSL.path || process.env.DOCKER_CERT_PATH;
      var ca = Meteor.settings.dockerSSL.ca || "ca.pem";
      var cert = Meteor.settings.dockerSSL.cert || "cert.pem";
      var key = Meteor.settings.dockerSSL.key || "key.pem"
      dockerHost.ca = fs.readFileSync(certPath + "/" + ca);
      dockerHost.cert = fs.readFileSync(certPath + "/" + cert);
      dockerHost.key = fs.readFileSync(certPath + "/" + key);
    }
    var d = new Docker(dockerHost);
    // Make sure the instance is up; TODO should probably do something
    // simple like a ping instead. Not sure if docker has connection test endpoint.
    try {
      Meteor.wrapAsync(d.info.bind(d))();
    } catch (error) {
      d = null;
    }

    return d;
  },
  getForHost: function getDockerForHost(hostId) {
    var target = Hosts.findOne(hostId);
    if (!target)
      throw new Meteor.Error(400, 'Bad request', "No defined docker host has ID " + hostId);
    return DockerActions.get({host: target.privateHost, port: target.port});
  },
  // Returns a docker object for the server that is running the
  // given app instance's container
  getForAppInstance: function getDockerForAppInstance(instanceId) {
    var ai = AppInstances.findOne({_id: instanceId});
    if (!ai)
      throw new Meteor.Error(400, 'Bad request', "No app instance has ID " + instanceId);
    var dockerHosts = ai.dockerHosts;
    if (!dockerHosts || !dockerHosts.length) {
      return null;
    }

    if (Hosts.find({_id: dockerHosts[0]}, {limit: 1}).count() !== 1) {
      // Host ID listed in AI doesn't exist
      return null;
    }
    // Currently each app instance runs on only one host
    return DockerActions.getForHost(dockerHosts[0]);
  }
};
