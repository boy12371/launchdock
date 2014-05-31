Meteor.startup(function () {
  // Listen for docker events
  docker.getEvents({since: ((new Date().getTime()/1000) - 60).toFixed(0)}, Meteor.bindEnvironment(function(err, stream) {
    if(err) {
      console.log("docker event error:", err);
    } else {
      stream.on('data', Meteor.bindEnvironment(function (data) {
        console.log("docker event:", data.toString());
        var evt = JSON.parse(data.toString());
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
        // Update app instance status
        AppInstances.update({containerId: evt.id}, {$set: {status: status}});
      }, 'docker.getEvents stream data'));
      stream.on('error', function (error) {
        console.log("docker event stream error:", error);
      });
    }
  }, 'docker.getEvents'));
});