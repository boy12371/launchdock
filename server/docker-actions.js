DockerActions = {
  // Get docker connection for host/port or for local server as fallback
  get: function getDocker(host, port) {
    var d;
    // To connect to another instance: (but careful because exposing on host gives root access, so that port should not be public to the Internet)
    if (host) {
      if (host.indexOf("http://") === 0) {
        host = host.replace("http://", "");
      }
      port = port || 4243;
      d = new Docker({host: "http://" + host, port: port});
    } else {
      var platform = os.platform();
      if (platform === "darwin") {
        // We are on OSX; need to connect slightly differently
        d = new Docker({host: 'http://127.0.0.1', port: 4243});
      } else {
        // We are on linux
        d = new Docker({socketPath: '/var/run/docker.sock'});
      }
    }
    return d;
  },
  // Return docker connection for the host that has the fewest containers
  getForBestHost: function getDockerForBestHost() {
    HostActions.updateAll();
    target = Hosts.findOne({}, {sort: {'details.Containers': 1}});
    if (target) {
      return DockerActions.get(target.privateHost, target.port);
    } else {
      return DockerActions.get();
    }
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
    return DockerActions.get(ai.docker.host, ai.docker.port);
  }
};