/*
 * Methods related to docker images: prefix with "image/"
 */

Meteor.methods({
  'image/add': function (imageName) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);

    try {
      var imageId = DockerImages.insert({
        name: imageName,
        inRepo: true
      });
    } catch (e) {
      throw new Meteor.Error(400, 'Bad Request', 'An image with that name already exists.');
    }

    ImageActions.createOnAllHosts(imageId);
    return true;
  },
  'image/addFromArchive': function (imageName, archiveUrl) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);

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
    Utility.checkLoggedIn(this.userId);

    ImageActions.removeOnAllHosts(imageId);
    DockerImages.remove({_id: imageId});
    
    return true;
  },
  'image/createOnAllHosts': function (imageId) {
    this.unblock();
    Utility.checkLoggedIn(this.userId);
    
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
    //Meteor._wrapAsync(docker.buildImage.bind(docker))(tarFile, {t: imageName, rm: 1});
  },
  // Pull a docker image from repo on a single host, if an image with that name
  // does not already exist on that host.
  pullOnHost: function pullImageOnHost(host, port, repoTag) {
    var docker = DockerActions.get(host, port);

    try {
      Meteor._wrapAsync(docker.pull.bind(docker))(repoTag);
    } catch (error) {
      throw new Meteor.Error(500, 'Internal server error', "Error pulling image: " + (error && error.message ? error.message : 'Unknown'));
    }
  },
  // Build a docker image from a tar on a single host
  buildOnHost: function buildImageOnHost(host, port, imageName, archiveUrl) {
    var docker = DockerActions.get(host, port);

    // XXX Do we want to build always, even if already present? Could be an updated archive.
    // var images = Meteor._wrapAsync(docker.listImages.bind(docker))();
    // var exists = _.any(images, function (image) {
    //   return image.RepoTags && _.contains(image.RepoTags, imageName + ":latest");
    // });
    // if (exists) return;

    // stream tar file to buildImage
    var tarStream = request(archiveUrl);
    if (!tarStream) {
      throw new Meteor.Error(500, 'Internal server error', "Unable to get build context archive from " + archiveUrl);
    }

    try {
      tarStream.on('error', function (error) { throw error; });
      Meteor._wrapAsync(docker.buildImage.bind(docker))(tarStream, {t: imageName, rm: 1});
    } catch (error) {
      throw new Meteor.Error(500, 'Internal server error', "Error reading " + archiveUrl + ' or building image: ' + (error && error.message ? error.message : 'Unknown'));
    }
  },
  // Create (pull or build) the docker image on all hosts if not already existing
  createOnAllHosts: function createImageOnAllHosts(imageId) {
    var image = DockerImages.findOne(imageId);
    if (!image)
      throw new Meteor.Error(500, 'Internal server error', "Invalid image ID");

    if (!image.inRepo && image.tarUrl) {
      var imageName = image.name;
      var archiveUrl = image.tarUrl;
      Hosts.find().forEach(function (host) {
        ImageActions.buildOnHost(host.privateHost, host.port, imageName, archiveUrl);
      });
    } else if (image.inRepo) {
      var repoTag = image.name + ":latest";
      Hosts.find().forEach(function (host) {
        ImageActions.pullOnHost(host.privateHost, host.port, repoTag);
      });
    }
  },
  // Remove the docker image from all hosts
  removeOnAllHosts: function removeImageOnAllHosts(imageId) {
    var image = DockerImages.findOne(imageId);
    if (!image)
      throw new Meteor.Error(500, 'Internal server error', "Invalid image ID");

    var imageName = image.name;
    Hosts.find().forEach(function (host) {
      var docker = DockerActions.get(host.privateHost, host.port);
      var dockerImage;
      var images = Meteor._wrapAsync(docker.listImages.bind(docker))();
      _.every(images, function (image) {
        if (image.RepoTags && _.contains(image.RepoTags, imageName + ":latest")) {
          dockerImage = docker.getImage(image.Id);
          return false;
        }
      });

      if (dockerImage) {
        Meteor._wrapAsync(dockerImage.remove.bind(dockerImage))();
      }
    });

    HostActions.updateAll();
  }
};