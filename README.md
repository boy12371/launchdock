meteor-launcher
===============

TODO Change name? It's more than just a launcher.

This is a Meteor app (not a package) that allows you to manage multiple instances of other Meteor apps running on the same server instance (TODO eventually on other server instances, too). In addition to managing the app instances, you can dynamically control proxy routing based on hostname, allowing you to simply map all relevant hostnames to the launcher server in DNS.

There is a browser interface (TODO the beginnings of one), but you can also remotely call the launcher API over DDP from another Meteor app (or anything that can use DDP).

TODO Eventually there will be a small launcher package that simplifies remote calls from a separate Meteor app.

## Server Setup

Before you can deploy the launcher app, you must have a properly configured server instance on which to deploy it. Here are instructions for creating an EC2 server with AWS:

1. In AWS Management Console, launch a new EC2 instance.
2. Choose 64-bit Ubuntu.
3. Choose micro or whatever size you want. Should be powerful enough to serve all the Meteor apps and the launcher app. (NEXT)
4. Accept defaults for instance settings (NEXT)
5. Accept defaults for storage. (NEXT)
6. Skip tags. (NEXT)
7. Select or create a security group with TCP access on port 80 and port 8000, and SSH access on port 22. For now, accepting from any source is fine, but in production, port 8000 should be limited to be accessible only from the IP address of the app or users that will control the launcher (TODO maybe we could require user login to manage the launcher; not sure how well that works server-to-server).
8. Review and click Launch.
9. Create a .pem or select one you already have on your workstation. If you create one, be sure to `chmod 400` it.
10. ssh -i ~/key.pem ubuntu@54.187.229.4 (replace correct key file path and correct IP address of new EC2 instance)

Once you are logged into the new instance over SSH, run the following commands (TODO we can script these using cloud init):

```bash
$ sudo apt-get update
$ sudo apt-get install docker.io
$ sudo ln -sf /usr/bin/docker.io /usr/local/bin/docker
$ sudo chmod 777 /var/run/docker.sock.
```

We have now launched the server instance and installed Docker on it. To deploy the meteor-launcher app to it, we will use [meteor-up](https://github.com/arunoda/meteor-up). If you don't already have this installed on your workstation, install it now:

```bash
$ (sudo) npm install -g mup
```

Then configure the launcher deployment:

1. Create a new folder for this deployment. Let's say `~/deployments/launcher`.
2. Copy `mup.json` and `settings.json` from this repo into the new folder.
3. Edit `mup.json`:
    * Change "host" and "pem" to the correct info for the EC2 instance you just launched.
    * Change "app" to the full local path to your clone of this repo.
    * Change the "env" variables to the correct variables for the launcher app to use. By default, the proxy server will run on port 80, so you should not use port 80 for the launcher app. But if you want to use port 80 for the launcher app, simply change the "proxyPort" setting in `settings.json` to whatever you want the proxy port to run on (and then be sure to route all your app hostnames to this port with DNS).
4. Save any changes to the JSON files.
5. `cd ~/deployments/launcher`
6. `mup setup`

## Deploy the Launcher App

Once all the inital setup is done, deploying the launcher is easy:

```bash
$ cd ~/deployments/launcher
$ mup deploy
```

Refer to the [meteor-up](https://github.com/arunoda/meteor-up) documentation for instructions for viewing the launcher app logs, restarting it, or changing its configuration.

## Preparing the Meteor Apps

The launcher runs the other Meteor apps in docker containers. You'll need a docker image for each release of each app that you want to run. The launcher can create the docker images for you, but you need to prep the app bundles.

1. Bundle the Meteor app as you normally would, giving it the name "bundle.tar.gz".
2. Copy the Dockerfile from this repo into your Meteor app's folder (alongside the bundle archive you just created).
3. Change to that directory in Terminal and enter `tar -cvzf <release_name>.tar.gz Dockerfile bundle.tar.gz`. The release name can be anything you want that identifies which app and which release you bundled for your later reference.
4. Make `<release_name>.tar.gz` available somewhere on the Internet. (For Reaction, upload to the `reaction-bundles` bucket in S3 and then make it public.)

## Using the Launcher

Once all the prepwork is done, you can use the launcher.

There are two ways to interact with the launcher. You can access it directly in a browser (using the EC2 instance's IP address plus the PORT environment variable you specified in `mup.json`, 8000 by default) or you can connect to it through DDP from another Meteor app. To connect from another app, call `var conn = DDP.connect(launcherUrl)` and then `conn.call` the available launcher methods.

### Build an Image

Before you can launch instances of an app, you need to make sure the app's docker image is present on the EC2 server:

```js
Meteor.call("buildImageIfNotExist", "reaction/v0.1.0", "https://s3-us-west-2.amazonaws.com/reaction-bundles/reaction_0.1.0.tar.gz", function () { console.log(arguments); });
```

If an image with that name already exists, nothing happens. Otherwise it will build an image with that name from the tar file URL you provide (which is the one you created in the "Preparing the Meteor Apps" section).

TODO Building the image takes some time (a few minutes?) and currently this method will return before the building is actually done. Need to figure out a good solution for notifying that the image is built.

### Launch an App Instance

```js
Meteor.call("launchAppInstance", {
    appImage: "reaction/v0.1.0",
    mongoUrl: "",
    rootUrl: "",
    host: "" //NOTE: For future use. Don't pass this option right now
  }, function () { console.log(arguments); });
```

The new app instance's ID is returned. If calling from another app, you will want to save this somewhere and use it whenever calling any of the other available methods.

### Other Methods

TODO Expand on these eventually, but for now here's a list:

* startAppInstance(instanceId)
* restartAppInstance(instanceId)
* stopAppInstance(instanceId)
* killAppInstance(instanceId)
* removeAppInstance(instanceId)
* getContainerInfo(instanceId)
* addHostname(instanceId, hostname)
* removeHostname(instanceId, hostname)

### TODO

* Buttons and better design on launcher app client
* Dynamic changing of root URL
* Load balancing
* Multiple EC2 instances/scaling
* SSL handling
* Support for SSH into docker container
* app instance logs
* Adjust launcher to consume Meteor app bundles directly since the Dockerfile is always the same
* Add hipache support for the proxying; maybe support both methods and do some performance comparisons.
* Stats, e-mailing, etc.