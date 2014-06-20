rocker-docker
===============

This is a Meteor app (not a package) that allows you to manage multiple instances of other Meteor app/Docker containers, either on a single server or multiple. In addition to managing the app instances, you can dynamically control proxy routing based on hostname, allowing you to simply map all relevant hostnames to the docker servers in DNS.

There is a browser interface, but you can also remotely call the launcher API over DDP from another Meteor app (or anything that can use DDP).

TODO Eventually there will be a small launcher package that simplifies remote calls from a separate Meteor app.

## Installation

Before you can deploy the launcher app, you must have a properly configured server instance on which to deploy it. Here are instructions for creating an EC2 server with AWS:

### Amazon Web Services Setup

1. In AWS Management Console, launch a new EC2 instance.
2. Choose 64-bit Ubuntu.
3. Choose micro or whatever size you want. Should be powerful enough to serve all the Meteor apps and the launcher app. (NEXT-CONFIGURE INSTANCE DETAILS)
4. Open Advanced Details -> User Data -> As text
5. In the text box, enter `#include https://raw.githubusercontent.com/ongoworks/rocker-docker/master/ec2-ubuntu-data-script.sh` (REVIEW AND LAUNCH)
6. Click "Edit security groups" in the warning message.
7. Select or create a security group with TCP access on port 80 and port 8080, and SSH access on port 22. For now, accepting from any source is fine, but in production, port 8080 should be limited to be accessible only from the IP address of the app or users that will control the launcher.
8. Review and click Launch.
9. Create a .pem or select one you already have on your workstation. If you create one, be sure to save it, and to `chmod 400` it locally.

We have now launched the server instance and installed Docker on it. The ec2-user-data script should have automatically pulled and installed the rocker-docker app. This takes a few minutes and may be still happening the first time you log in. If you have any trouble with commands, log off the server, wait a few minutes, and then SSH to the server and try again.

To connect to the server, `ssh -i ~/key.pem ubuntu@54.187.229.4` (replace correct key file path and correct IP address of new EC2 instance).

Continue with the necessary docker commands:

```bash
$ docker run --name hipache-npm -p ::6379 -p 80:80 -d ongoworks/hipache-npm
$ docker run -d -v /var/run/docker.sock:/var/run/docker.sock --name launcher --link hipache-npm:hipache -e MONGO_URL="<launcher db connect string>" -e ROOT_URL="http://127.0.0.1" -e PORT="8080" -p ::8080 -i -t ongoworks/rocker-docker
```

If the commands are successful, you can see the launcher in your browser by going to:

```
http://<your server address>:8080
```

Log in with username "admin" and password "admin". Once logged in, change the admin password.

## Step 1: Add Docker Hosts

On the Hosts screen, you can manage docker hosts. These are the servers on which your app instances will run, within docker containers. You must first set up the server and install Docker on it. Then you can add it to the hosts list here.

For a single server example, where docker apps are launched on the same docker server that is running rocker-docker, you can add:

    private host: http://127.0.0.1
    public host: http://127.0.0.1
    port: 4243
    max containers: 100

The private host is the address of the docker server you wish to launch apps on. The public host is the publicly accessible address that will be used by the proxy server. You should always lock down port 4243 on your servers. On AWS, with security groups you can do this by adding the security group IP to the custom IP field of a tcp/4243 entry.

## Step 2: Add an App Image

The launcher runs the other Meteor apps in docker containers as well. You'll need a docker image for each release of each app that you want to run.

### Get the Dockerfile

```bash
cd <yourprojectroot>
curl -O https://raw.githubusercontent.com/ongoworks/rocker-docker/master/Dockerfile
```

Commit the file to source control.

### (Option 1) Build the Image Automatically

If your project is on github, you can use [Docker.io Trusted Builds](https://index.docker.io/help/docs/#trustedbuilds) to automatically make updated project builds. 
Go to docker.io, register, and go to Trusted Builds and point to your repo.

### (Option 2) Build the Image Manually

Install Docker. See [Getting started with Docker](https://www.docker.io/gettingstarted/)

First build the docker image:

```bash
cd <yourprojectroot>
docker build --tag="<reponame>/<app>" .
```

Then push to docker.io or a private docker repo:

```bash
docker push <reponame>/<app>
```

### Add the Image to Rocker-Docker

On the Images screen, enter into the Name field the "<reponame>/<app>" tag you used when building the image, leave "In Repo" selected, and then click Add. Your app image will be pulled on every defined host.

## Step 3: Manage App Instances

On the App Instances screen, fill out the "Launch a New Instance" form and submit it. You should see the app instance launch almost immediately. At this point you can select it in the list and view additional information about it, start/stop/restart it, remove it, etc.

## Advanced Usage: From Another App

If you have another Meteor app (or any program that supports DDP) that needs to launch app instances or do anything else, it can connect directly to the Rocker-Docker app and call API methods.

### Log In

You will need to log in as "admin" on the DDP connection before you can call any of the API methods. You can add the ddp-login package to your app to do this.

### Launch Example

```javascript
var conn = DDP.connect("http://<rocker-docker-address>:8080");
var MONGO_URL = "<app mongo url>";
var hostname = "<site url>";

function doLaunch() {
    conn.call("ai/launch", {
      appImage: "<reponame>/<app>",
      mongoUrl: "mongodb://<dbuser>:<dbpass>@<dbhost>:<dbport>/<dbname>",
      hostname: "<www.domain.com>",
      rootUrl: "<site absoluteUrl>",
      env: {
        MAIL_URL: "<smtp credentials>"
      }
    }, function (error, result) {
      if (error)
        console.log("Error in launchAppInstance: " + error);
      else
        console.log("New app instance ID is " + result);
    });
}

DDP.loginWithPassword(conn, {username: 'admin'}, 'admin', function (error) {
    if (error) {
      console.log(error);
    } else {
      doLaunch();
    }
});
```

The new app instance's ID is returned by "ai/launch". You will want to save this somewhere within the calling app and use it whenever calling any of the other available methods.

### Other App Instance API Methods

* `conn.call("ai/rebuild", instanceId, callback)`: Kill this app instance after cloning it to a new docker container.
* `conn.call("ai/restart", instanceId, callback)`: Restart the docker container for this instance
* `conn.call("ai/start", instanceId, callback)`: Start the docker container for this instance
* `conn.call("ai/stop", instanceId, callback)`: Stop (gracefully) the docker container for this instance
* `conn.call("ai/kill", instanceId, callback)`: Kill the docker container for this instance
* `conn.call("ai/remove", instanceId, callback)`: Remove this instance
* `conn.call("ai/getEnvironmentVariables", instanceId, callback)`: Returns the defined environment variables for this instance. These are those provided when launching but may not be the actual environment variables in the container if they were changed after launch for some reason.
* `conn.call("ai/addHostname", instanceId, hostname, callback)`: Add a hostname to be routed to this instance.
* `conn.call("ai/removeHostname", instanceId, hostname, callback)`: No longer route the given hostname to this instance.
* `conn.call("ai/getContainerInfo", instanceId, callback)`: Returns information about the docker container in which this app instance is running.

### Host API Methods

* `conn.call("host/add", privateHost, publicHost, port, max, active, callback)`: Add a docker host.
* `conn.call("host/refreshDetails", hostId, callback)`: If a `hostId` is provided, refreshes the docker information for that host and returns it. If no `hostId` is provided, refreshes the docker information for all defined hosts.

### Image API Methods

* `conn.call("image/add", imageName, callback)`: Add an image to all hosts by pulling the image with the given name.
* `conn.call("image/addFromArchive", imageName, archiveUrl, callback)`: Add an image to all hosts by downloading the tarfile and building it with the given image name.
* `conn.call("image/remove", imageId, callback)`: Remove the image from the list of images and from all docker hosts.
* `conn.call("image/createOnAllHosts", imageId, callback)`: Re-create (pull or build) the given image on all defined docker hosts.

## TODO

* Dynamic changing of root URL
* Load balancing (currently distributes instantiation)
* Auto scaling hooks to automatically update hosts
* SSL handling
* Support for SSH into docker container
* app instance logs
* Ability to consume Meteor app bundles directly since the Dockerfile is always the same.
* Stats, e-mailing, etc.
