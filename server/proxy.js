 // 1. check if image exists
 // 2. download image if it doesn't exist
 // 3. check if container exists and is running
 // 4. restart container if exists and if not running
 // 5. start container if doesn't exist


// Check to see if image exists
function imageExists(repoTag) {
      console.log(images)
    _.each(images, function (image) {
        if (_.contains(image.RepoTags, repoTag)) {
          return true;
        }
     });
}



 // DockerProxy = {
 //  pull: function pullProxy(dockerProxy) {
 //    console.log("No hipache-npm image found, we're pulling one.");
 //    var images = Meteor._wrapAsync(dockerProxy.listImages.bind(dockerProxy))();
 //    console.log(images)
 //    // Check to see if image exists
 //    var imageExists = false;
 //    _.each(images, function (image) {
 //        if (_.contains(image.RepoTags, 'ongoworks/hipache-npm:latest')) {
 //          imageExists = true;
 //          return;
 //        }
 //     });
 //    console.log(imageExists)
 //    // image doesn't exist, download it
 //    if (imageExists === false) {
 //      console.log("downloading")
 //      dockerProxy.pull('ongoworks/hipache-npm:latest', function (err, stream) {
 //        stream.pipe(process.stdout, {end: true});
 //        stream.on('end', function() {
 //          console.log("Download finished")
 //          return imageExists = true;
 //        });
 //      });
 //    } else {
 //      console.log ("hipache-npm ")
 //    }

 //  }
 // };




// we're going to pull the latest, regardless if it exists
//   try {
//       dockerProxy.pull('ongoworks/hipache-npm:latest', function (err, stream) {
//         stream.pipe(process.stdout);
//       });
//   } catch (error) {
//     console.log("Downloading hipache")
//   }
//   //if the image exists we'll start it up
//   try {
//     container = Meteor._wrapAsync(dockerProxy.createContainer.bind(dockerProxy))({
//       Image: 'ongoworks/hipache-npm',
//       name: 'hipache-npm',
//       ExposedPorts: {
//         "6379/tcp": {}, // docker will auto-assign the host port this is mapped to
//         "80/tcp": {}
//       }
//     });
//     Meteor._wrapAsync(container.start.bind(container))({"PortBindings": { "6379/tcp": [{ "HostIp": "0.0.0.0" }],"80/tcp": [{ "HostIp": "0.0.0.0", "HostPort": "80" }] } });
//   } catch (e) {
//     console.log("...")
//   }



// }

// if (!containerInfo) containerInfo = Meteor._wrapAsync(container.inspect.bind(container))();
