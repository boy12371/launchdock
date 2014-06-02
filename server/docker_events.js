listenToDockerEvents = function listenToDockerEvents(dockr) {
  Meteor.startup(function () {
    // Listen for docker events
    var now = ((new Date().getTime()/1000) - 60).toFixed(0);
    dockr.getEvents({since: now}, Meteor.bindEnvironment(function(err, stream) {
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