/*
 * Methods related to docker images: prefix with "image/"
 */

Meteor.methods({
  'image/add': function (imageName) {
    this.unblock();
    check(imageName, String);
    Utility.checkLoggedIn(Meteor.userId());

    try {
      var imageId = DockerImages.insert({
        name: imageName,
        inRepo: true,
        shared: true,
        registryUrl: "https://registry.hub.docker.com"
        // TODO: both shared and this registry can be used in future for additional registry
      });
    } catch (e) {
      imageId = DockerImages.findOne({'name':imageName})._id;
    }
    if (!imageId) throw new Meteor.Error(400, 'Bad Request', 'Unable to use this image.');

    ImageActions.createOnAllHosts(imageId);
    return imageId;
  },
  //
  // method to just check to that that is image is on all host
  //
  'image/exists': function (imageName) {
    check(imageName, String);
    var hostCount = 0;
    var imageCount = 0;
    // console.log("checking status"+imageName)
    Hosts.find({'status':'Active','active': true}).forEach(function (host) {
      hostCount ++;
      if ((_.where(host.dockerImages, {name:imageName}).length) > 0) imageCount++;
    });
    if (imageCount >= hostCount) {
      // If it actually exists but we had a timeout during download
      DockerImages.update({name:imageName},{$set:{status:"Downloaded"}});
      return true;
    } else {
      return false;
    }
  },
  //
  // method check all hosts to check download progress and existance on all hosts
  // took this approach over streams of pull status, maybe reinvestigate
  // but as we're likely pulling on multiple hosts, merging stream status was PiTA
  // however, this is prone to misreporting as we're not filtering for latest
  //
  'image/status': function (imageName) {
    check(imageName,String);
    Utility.checkLoggedIn(Meteor.userId());
    var maxCheck = 250;
    var statusCheck = 0;

    var image = DockerImages.findOne({'name':imageName})
    // loop up to maxCheck, checking for image on all hosts.
    var intervalId = Meteor.setInterval(function() {
      var hostCount = 0;
      var imageCount = 0;
      console.log("checking image/status: "+imageName)
      Hosts.find({'status':'Active','active': true}).forEach(function (host) {
        hostCount ++;
        if ((_.where(host.dockerImages, {name:imageName}).length) > 0) imageCount++;
      });
      statusCheck ++;
      console.log("checking image/status: "+imageName)
      if (imageCount >= hostCount) {
        console.log("download finished for: "+imageName)
        DockerImages.update(image._id,{$set:{status:"Downloaded"}});
        HostActions.updateAll();
        Meteor.clearInterval(intervalId);
        return {status:"Downloaded"};
      } else if (statusCheck >= maxCheck) {
        console.log("download taking too long: "+imageName)
        DockerImages.update(image._id,{$set:{status:"Pending"}});
        HostActions.updateAll();
        Meteor.clearInterval(intervalId);
        return {status:"Pending"};
      } else {
        // Ideally we'd get the size of the image but api doesn't support yet
        percent = (statusCheck/maxCheck *100).toFixed(0).toString();
        DockerImages.update(image._id,{$set:{status:percent}});
        HostActions.updateAll();
      }
    }, 2500);

  },
  'image/addFromArchive': function (imageName, archiveUrl) {
    this.unblock();
    check(imageName, String);
    Utility.checkLoggedIn(Meteor.userId());

    try {
      var imageId = DockerImages.insert({
        name: imageName,
        inRepo: false,
        tarUrl: archiveUrl
      });
    } catch (e) {
      throw new Meteor.Error(400, 'Bad Request', 'An image with that name already exists.');
    }

    ImageActions.createOnAllHosts(imageId);
    return true;
  },
  'image/remove': function (imageId) {
    this.unblock();
    check(imageId, String);
    Utility.checkLoggedIn(Meteor.userId());

    if (AppInstances.findOne({'image':this.name})) return false;

    ImageActions.removeOnAllHosts(imageId);
    DockerImages.remove({_id: imageId});

    return true;
  },
  'image/createOnAllHosts': function (imageId) {
    check(imageId, String);
    Utility.checkLoggedIn(Meteor.userId());

    ImageActions.createOnAllHosts(imageId);
    return true;
  },
});

ImageActions = {
  // buildFromGitRepo is WORK IN PROGRESS
  buildFromGitRepo: function buildImageFromGitRepo(gitUrl) {
    // Create a temp directory for this bundle
    var tempBundleDir = path.join(os.tmpdir(), Random.id());
    Utility.ensureDir(tempBundleDir);

    // Git clone into the temp dir
    // TODO use git-node pkg?

    // Copy the Dockerfile into the bundle temp dir
    fs.writeFileSync(path.join(tempBundleDir, 'Dockerfile'), fs.readFileSync(path.join(serverDir, 'assets/app/Dockerfile')));

    // Build image from local path
    // var tarFile = ? // TODO need to bundle local path into tar.gz
    //Meteor.wrapAsync(docker.buildImage.bind(docker))(tarFile, {t: imageName, rm: 1});
  },
  // Pull a docker image from repo on a single host, if an image with that name
  // does not already exist on that host.
  pullOnHost: function pullImageOnHost(dockerHost, repoTag) {
    var docker = DockerActions.get(dockerHost);
    if (!docker) return false;
    try {
      Meteor.wrapAsync(docker.pull.bind(docker))(repoTag);
    } catch (error) {
      throw new Meteor.Error(500, 'Internal server error', "Error pulling image: " + (error && error.message ? error.message : 'Unknown'));
    }
  },

  // Build a docker image from a tar on a single host
  buildOnHost: function buildImageOnHost(dockerHost, imageName, archiveUrl) {
    var docker = DockerActions.get(dockerHost);

    if (!docker) return false;

    // XXX Do we want to build always, even if already present? Could be an updated archive.
    // var images = Meteor.wrapAsync(docker.listImages.bind(docker))();
    // var exists = _.any(images, function (image) {
    //   return image.RepoTags && _.contains(image.RepoTags, imageName + ":latest");
    // });
    // if (exists) return;

    // stream tar file to buildImage
    var tarStream = Meteor.get(archiveUrl);
    if (!tarStream) {
      throw new Meteor.Error(500, 'Internal server error', "Unable to get build context archive from " + archiveUrl);
    }

    try {
      tarStream.on('error', function (error) { throw error; });
      Meteor.wrapAsync(docker.buildImage.bind(docker))(tarStream, {t: imageName, rm: 1});
    } catch (error) {
      throw new Meteor.Error(500, 'Internal server error', "Error reading " + archiveUrl + ' or building image: ' + (error && error.message ? error.message : 'Unknown'));
    }
  },
  // Create (pull or build) the docker image on all hosts if not already existing
  createOnAllHosts: function createImageOnAllHosts(imageId) {
    var image = DockerImages.findOne(imageId);
    if (!image)
      throw new Meteor.Error(500, 'Internal server error', "Invalid image ID");
    // a tar.gz build
    if (!image.inRepo && image.tarUrl) {
      var imageName = image.name;
      var archiveUrl = image.tarUrl;
      Hosts.find().forEach(function (host) {
        ImageActions.buildOnHost({'host': host.privateHost, 'port': host.port, 'protocol': host.protocol}, imageName, archiveUrl);
      });
    // Already been used before, but we're pulling
    } else if (image.inRepo) {
      var repoTag = image.name + ":latest";
      Hosts.find().forEach(function (host) {
        console.log("Pulling "+image.name+" on: "+ host.privateHost);
        ImageActions.pullOnHost({'host': host.privateHost, 'port': host.port, 'protocol': host.protocol}, repoTag);
      });
      // Trigger status update routine (updates status field on image)
      Meteor.call('image/status',image.name);
    }
  },
  // Remove the docker image from all hosts
  removeOnAllHosts: function removeImageOnAllHosts(imageId) {
    var image = DockerImages.findOne(imageId);
    if (!image)
      throw new Meteor.Error(500, 'Internal server error', "Invalid image ID");

    var imageName = image.name;
    console.log("deleting image:"+imageName)
    Hosts.find().forEach(function (host) {
      var docker = DockerActions.get({'host': host.privateHost, 'port': host.port,'protocol': host.protocol });
      if (!docker) return;
      var dockerImage;
      var images = Meteor.wrapAsync(docker.listImages.bind(docker))();
      _.each(images, function (image) {
        if (_.contains(image.RepoTags, imageName + ":latest")) {
          console.log("Deleted image: "+imageName)
          dockerImage = docker.getImage(image.Id);
          Meteor.wrapAsync(dockerImage.remove.bind(dockerImage))();
        }
      });
    });

    HostActions.updateAll();
  }
};
