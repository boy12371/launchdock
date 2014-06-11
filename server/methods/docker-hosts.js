/*
 * Methods related to docker hosts: prefix with "host/"
 */

Meteor.methods({
  'host/add': function addHost(privateHost, publicHost, port, max, active) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);

    Hosts.insert({privateHost: privateHost, publicHost: publicHost, port: port, max: max, active: active});
    return true;
  },
  // Refresh details and image list for all hosts or refresh and return details and image list for one host
  'host/refreshDetails': function refreshDetailsForHost(hostId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);

    if (hostId) {
      var host = Hosts.findOne(hostId);
      return HostActions.getInfo(host);
    } else {
      HostActions.updateAll();
      return true;
    }
  }
});

/*
 * Private support functions
 */

HostActions = {
  getInfo: function getInfo(host) {
    var docker = DockerActions.get(host.privateHost, host.port);
    var info = Meteor._wrapAsync(docker.info.bind(docker))();
    var imageList = Meteor._wrapAsync(docker.listImages.bind(docker))();
    var dockerImages = _.map(imageList, function (image) {
      return {
        name: image.RepoTags && image.RepoTags[0] && image.RepoTags[0].split(":")[0] || "None",
        id: image.Id,
        createdAt: new Date(image.Created * 1000),
        virtualSize: image.VirtualSize
      };
    });
    // Update in Hosts document while we have it
    Hosts.update(host._id, {
      $set: {
        details: info,
        dockerImages: dockerImages
      }
    });
    return info;
  },
  // Check live docker host information and save to hosts db
  updateAll: function updateAll() {
    Hosts.find().forEach(function (host) {
      HostActions.getInfo(host);
    });
  }
};