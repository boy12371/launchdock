/*
 * Methods related to docker hosts: prefix with "host/"
 */

Meteor.methods({
  'host/add': function addHost(doc) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    Schemas.Host.clean(doc);
    check(doc, Schemas.Host);

    var d = DockerActions.get({host:doc.privateHost, port: doc.port, protocol: doc.protocol});

    if (!d) {
      return false;
    }

    return Hosts.insert(doc);
  },
  // Refresh details and image list for all hosts or refresh and return details and image list for one host
  'host/refreshDetails': function refreshDetailsForHost(hostId) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());

    if (hostId) {
      var host = Hosts.findOne(hostId);
      return HostActions.getInfo(host);
    } else {
      HostActions.updateAll();
      return true;
    }
  },
  'host/remove': function removeHost(hostId, keepAppsActive) {
    this.unblock();
    Utility.checkLoggedIn(Meteor.userId());
    console.log("Removing host: " + hostId);
    var cursor = AppInstances.find({dockerHosts: hostId});

    // Deactivate all app instances on the host we're going to remove
    cursor.forEach(function (ai) {
      ContainerActions.removeForAppInstance(ai._id);
    });

    // Remove the host
    Hosts.remove({_id: hostId});

    // Reactivate app instances on a new host if requested
    keepAppsActive && cursor.forEach(function (ai) {
      ContainerActions.addForAppInstance(ai._id);
    });

    return true;
  },
});

/*
 * Private support functions
 */
HostActions = {
  // Get host status, and update status in Hosts collection
  // active = enabled by user (true/false)
  // status = docker connection status (Active/Error)
  getInfo: function getInfo(host) {
    var docker = DockerActions.get({host:host.privateHost, port: host.port, protocol: host.protocol});
    // if we can't reach the host, mark it, and stop using it.
    if (!docker) {
      Hosts.update(host._id, {
          $set: {
            status: "Error",
            active: false
          }
      });
      return false;
    }
    var info = Meteor.wrapAsync(docker.info.bind(docker))();
    var imageList = Meteor.wrapAsync(docker.listImages.bind(docker))();
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
        status: "Active",
        dockerImages: dockerImages
      }
    });
    return info;
  },
  // Check live docker host information and save to hosts db
  // if a host goes down, you need to manually start it
  updateAll: function updateAll() {
    Hosts.find({'active': true}).forEach(function (host) {
      HostActions.getInfo(host);
    });
  },
  // Return the doc for the host that has the fewest containers; TODO check defined max, too
  getBest: function getBest() {
    HostActions.updateAll();
    var bestHost = '';
    var hosts = Hosts.find({'status':'Active','active': true},{sort: {'details.Containers': 1} } ).fetch();
    _.each(hosts, function (h) {
       if (bestHost) return;
       if (h.userId == Meteor.userId() ) {
        if (h.max > h.details.Containers) return bestHost = h;
       } else {
        //lookup up instances that don't belong to user on this host, decided if there is a shared available
          shared = Hosts.find({'_id':h._id, userId: {$ne: Meteor.userId() }}).count();
          if (shared < h.shared && h.max > h.details.containers) return bestHost = h;
       }
    });
    return bestHost;
  }
};
