launchdock
===============

This is a Meteor app (not a package) that allows you to manage multiple instances of other Meteor app/Docker containers, either on a single server or multiple. In addition to managing the app instances, you can dynamically control proxy routing based on hostname, allowing you to simply map all relevant hostnames to the docker servers in DNS.

There is a browser interface, but you can also remotely call the launcher API over DDP from another Meteor app (or anything that can use DDP).

TODO Eventually there will be a small launcher package that simplifies remote calls from a separate Meteor app.

# Local Development Setup

Install [meteor](http://meteor.com).

Install [boot2docker](http://boot2docker.io/).

*Your VM might have a different DOCKER_HOST IP address and DOCKER_CERT_PATH. Use whatever boot2docker up told you to use. You probably want to add those environment variables to your shell config.*

Or add this to your shell profile, or run:

```bash
   $(boot2docker shellinit)
```

Optionally, install the `ongoworks/hipache-npm` docker image (if you don't we'll pull one when you run Launchdock):

`docker pull ongoworks/hipache-npm`

Clone launchdock local, then from the `launchdock` directory, run `meteor`. This should be all you need for a local Launch Dock development environment.

```bash
  git clone https://github.com/ongoworks/launchdock.git
  cd launchdock
  meteor
```

*Note: If you have an SSL connection error connecting to Docker, copy files from `DOCKER_CERT_PATH` to `private/docker/`*

There are additional docker host configuration options available in `settings/settings.json`.

You can execute with modified settings.json, or meteor options:

`meteor --settings settings/settings.json  --port 3003`

# Server Configuration
## Configure the Launch Dock Server

For production server deployment, before you can run launchdock, you must have a properly configured server instance on which to run it.

### General Instructions

First install docker. Refer to the instructions on the Docker website. For example, for an Ubuntu server, you should be able to install the latest docker release with this command:

```bash
$ curl -s https://get.docker.io/ubuntu/ | sudo sh
```

To prevent having to `sudo` when using docker as your OS user, add your user to the "docker" group:

```bash
$ sudo usermod -aG docker <username>
$ newgrp docker
```

(The first command adds your user to the "docker" group. The second command applies that permission change to the current shell so that you don't have to log out and log back in.)

Now allow connections to the Docker daemon on port 2375:

```bash
$ echo "DOCKER_OPTS=\"-H tcp://0.0.0.0:2375 -H unix://var/run/docker.sock\"" | sudo tee -a /etc/default/docker
```

This requires restarting the Docker daemon, for example:

```bash
$ sudo service docker restart
```

Or:

```bash
$ sudo reboot
```

Finally, you must make sure port 80 is open for TCP traffic, hipache will use this to route requests the assigned container ports..

### Amazon Web Services Instructions

Here are instructions for creating an EC2 server with AWS. This is essentially the same as the "General Instructions", but there is a user data script that makes it a bit easier.

1. In AWS Management Console, launch a new EC2 instance.
2. Choose 64-bit Ubuntu.
3. Choose micro or whatever size you want. Should be powerful enough to serve all the Meteor apps and the launcher app. (NEXT-CONFIGURE INSTANCE DETAILS)
4. Open Advanced Details -> User Data -> As text
5. In the text box, enter `#include https://raw.githubusercontent.com/ongoworks/launchdock/master/install/ubuntu/ec2-ubuntu-init-data.sh` (REVIEW AND LAUNCH)
6. Click "Edit security groups" in the warning message.
7. Select or create a security group with TCP access on port 80 and port 8080, and SSH access on port 22. For now, accepting from any source is fine, but in production, port 8080 should be limited to be accessible only from the IP address of the app or users that will control the launcher.
8. Review and click Launch.
9. Create a .pem or select one you already have on your workstation. If you create one, be sure to save it, and to `chmod 400` it locally.

We have now launched the server instance and installed Docker on it. To connect to the server, `ssh -i ~/key.pem ubuntu@54.187.229.4` (replace correct key file path and correct IP address of new EC2 instance).

## Install the Launch Dock App

```bash
$ docker pull ongoworks/hipache-npm
$ docker pull ongoworks/launchdock
```

It may take awhile for the images to finish pulling. Use `docker images` command to check.

## Set Up Additional Docker Hosts (Optional)

If you need to be able to launch hundreds of app containers, or if you prefer to run the app instances on servers that are separate from the server running launchdock, you can set up additional servers running Docker, and launchdock will distribute your app instances across all of them. (See Step 1: Add Docker Hosts)

If you're just getting started with launchdock, you might want to skip this for now and get things working on a single server first.

The steps for this are actually the same as for setting up the Launch Dock server. See "Configure the Launch Dock Server", except that you do not need to open port 80 or 8080.

### Firewall Considerations

Check to see if you have a firewall enabled:

```bash
$ sudo ufw status verbose
```

If the firewall is active, you'll need to allow ports 2375 and 2376 through. First edit `/etc/default/ufw` and change `DEFAULT_FORWARD_POLICY` from "DROP" to "ACCEPT". Then:

```bash
$ sudo ufw reload
$ sudo ufw allow 2375/tcp
$ sudo ufw allow 2376/tcp
```

**Note that connections on 2375/2376 will have root access, so you should limit access to the server running Launch Dock, ideally within a VPC.**

## Create a MongoDB Database For the Launch Dock App

Create it wherever you like, so long as you have a MongoDB connection URL that you can use in the next step.

## Start the Launch Dock App

Run two commands. In the second command, be sure to replace the placeholder text with the correct values. The `-e ROOT_URL=""` can be omitted from that command if you are accessing the Launch Dock admin site by IP address rather than a domain name.

```bash
$ docker run --name hipache-npm -p ::6379 -p :80:80 -d ongoworks/hipache-npm
$ docker run --name launchdock --link hipache-npm:hipache-npm -e MONGO_URL="<launcher db connect string>" -e ROOT_URL="http://<domain.name>" -p :8080:8080 -d ongoworks/launchdock
```

If the commands are successful, you can see the Launch Dock administrator app in your browser by going to:

```
http://<your server address>:8080
```

Log in with username "admin" and password "admin". Once logged in, change the admin password.

Troubleshooting: If you don't see anything when accessing that address in your browser, verify that port 8080 is open and check the container logs using `docker logs launchdock`.

## Step 1: Add Docker Hosts

On the Hosts screen, you can manage docker hosts. These are the servers on which your app instances will run, within docker containers. You must first set up the server and install Docker on it (see "Set Up Additional Docker Hosts". Then you can add it to the hosts list here.

If you are running app instances on the same docker server that is running launchdock, you can add:

    private host: http://127.0.0.1
    public host: http://127.0.0.1
    port: 2375
    max containers: 100

The private host is the address of the docker server you wish to launch apps on. The public host is the publicly accessible address that will be used by the proxy server. You should always lock down port 2375 on your servers. On AWS, with security groups you can do this by adding the security group IP to the custom IP field of a tcp/2375 entry.

## Step 2: Add an App Image

The launcher runs the other Meteor apps in docker containers as well. You'll need a docker image for each release of each app that you want to run.

### Get the Dockerfile

```bash
cd <yourprojectroot>
curl -O https://raw.githubusercontent.com/ongoworks/launchdock/master/Dockerfile
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

### Add the Image to Launchdock

On the Images screen, enter into the Name field the "<reponame>/<app>" tag you used when building the image, leave "In Repo" selected, and then click Add. Your app image will be pulled on every defined host.

## Step 3: Manage App Instances

On the App Instances screen, fill out the "Launch a New Instance" form and submit it. You should see the app instance launch almost immediately. At this point you can select it in the list and view additional information about it, start/stop/restart it, remove it, etc.

## Updating Launch Dock

```bash
$ docker pull ongoworks/launchdock
$ docker stop launchdock
$ docker rm launchdock
$ docker run -v /var/run/docker.sock:/var/run/docker.sock --name launchdock --link hipache-npm:hipache-npm -e MONGO_URL="<launcher db connect string>" -e ROOT_URL="http://<domain.name>" -p :8080:8080 -d ongoworks/launchdock
```

The `-e ROOT_URL=""` can be omitted from the run command if you are accessing the Launch Dock admin site by IP address rather than a domain name.

## Advanced Usage: From Another App

If you have another Meteor app (or any program that supports DDP) that needs to launch app instances or do anything else, it can connect directly to the Launchdock app and call API methods.

### Log In

You will need to log in as "admin" on the DDP connection before you can call any of the API methods. You can add the ddp-login package to your app to do this.

### Launch Example

```javascript
var conn = DDP.connect("http://<launchdock-address>:8080");
var mongoUrl = "<app mongo url>";
var hostname = "<site url>";
var appImage = "<reponame>/<app>";
var mailUrl = "<smtp credentials>";
var rootUrl = "<site absoluteUrl>";

function doLaunch() {
    conn.call("ai/launch", {
      appImage: appImage,
      hostname: hostname,
      env: {
        MAIL_URL: mailUrl,
        MONGO_URL: mongoUrl,
        ROOT_URL: rootUrl
      }
    }, function (error, result) {
      if (error)
        console.log("Error in ai/launch: " + error);
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

* `conn.call("host/add", {privateHost, publicHost, port, max, active}, callback)`: Add a docker host.
* `conn.call("host/refreshDetails", hostId, callback)`: If a `hostId` is provided, refreshes the docker information for that host and returns it. If no `hostId` is provided, refreshes the docker information for all defined hosts.

### Image API Methods

* `conn.call("image/add", imageName, callback)`: Add an image to all hosts by pulling the image with the given name.
* `conn.call("image/addFromArchive", imageName, archiveUrl, callback)`: Add an image to all hosts by downloading the tarfile and building it with the given image name.
* `conn.call("image/remove", imageId, callback)`: Remove the image from the list of images and from all docker hosts.
* `conn.call("image/createOnAllHosts", imageId, callback)`: Re-create (pull or build) the given image on all defined docker hosts.

## TODO

* Specify container linking (--link) at launch, which would allow, for example, launching a container from the `wordpress` image linked to a container from the `mysql` image, or Meteor container linked to mongodb container, etc.
* Dynamic changing of root URL
* Load balancing (currently distributes instantiation)
* Auto scaling hooks to automatically update hosts
* SSL handling
* Support for SSH into docker container
* app instance logs
* Ability to consume Meteor app bundles directly since the Dockerfile is always the same.
* Stats, e-mailing, etc.
