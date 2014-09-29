DockerActions = {
  // Get docker connection for host/port or for local server as fallback
  get: function getDocker(host, port) {
    if (!host)
      return null;

    if (host.indexOf("http://") === 0) {
      host = host.replace("http://", "");
    }
    port = port || 2375;
    var d = new Docker({host: "http://" + host, port: port, timeout: 500});

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
    return DockerActions.get(target.privateHost, target.port);
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