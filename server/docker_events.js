var listeningTo = {};

// Call this to begin listening to docker events from a docker daemon at host/port,
// unless already listening.
listenToDockerEvents = function listenToDockerEvents(host, port) {
  if (host.indexOf("http://") === 0) {
    host = host.replace("http://", "");
  }

  var hostPort = host + ":" + port;
  if (listeningTo[hostPort]) {
    // already listening to this docker server
    return;
  }
  listeningTo[hostPort] = true;

  var docker = new Docker({host: "http://" + host, port: port});
  Meteor.startup(function () {
    // Listen for docker events
    var now = ((new Date().getTime()/1000) - 60).toFixed(0);
    docker.getEvents({since: now}, Meteor.bindEnvironment(function(err, stream) {
      if(err) {
        console.warn("docker event error:", err);
      } else {
        stream.on('data', Meteor.bindEnvironment(function (data) {
          var evt = data;
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
          } else if (evt.status === "kill") {
            status = "stopped";
          } else {
            status = evt.status;
          }
          // Update app instance status and log event
          // If this is not a tracked container, no update
          // will happen and that's OK.
          AppInstances.update({containerId: evt.id}, {
            $set: {status: status},
            $push: {dockerEvents: evt}
          });
        }, 'docker.getEvents stream data'));
        stream.on('error', function (error) {
          console.warn("docker event stream error:", error);
        });
      }
    }, 'docker.getEvents'));
  });
};

// And at startup, we want to restart event listening for all defined hosts.
// TODO we probably want to explicitly update the status of all app instances, too
Meteor.startup(function () {
  Hosts.find().forEach(function (host) {
    listenToDockerEvents(host.privateHost, host.port);
  });
});