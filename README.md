rocker-docker
===============

This is a Meteor app (not a package) that allows you to manage multiple instances of other Meteor app/Docker containers, either on a single server or multiple. In addition to managing the app instances, you can dynamically control proxy routing based on hostname, allowing you to simply map all relevant hostnames to the docker servers in DNS.

There is a browser interface (TODO the beginnings of one), but you can also remotely call the launcher API over DDP from another Meteor app (or anything that can use DDP).

TODO Eventually there will be a small launcher package that simplifies remote calls from a separate Meteor app.

## Amazon Web Services Setup

Before you can deploy the launcher app, you must have a properly configured server instance on which to deploy it. Here are instructions for creating an EC2 server with AWS:

### Server Setup

1. In AWS Management Console, launch a new EC2 instance.
2. Choose 64-bit Ubuntu.
3. Choose micro or whatever size you want. Should be powerful enough to serve all the Meteor apps and the launcher app. (NEXT-CONFIGURE INSTANCE DETAILS)
4. Open Advanced Details -> User Data -> As text
5. In the text box, enter `#include https://raw.githubusercontent.com/ongoworks/rocker-docker/master/ec2-ubuntu-data-script.sh` (REVIEW AND LAUNCH)
6. Click "Edit security groups" in the warning message.
7. Select or create a security group with TCP access on port 80 and port 8080, and SSH access on port 22. For now, accepting from any source is fine, but in production, port 8080 should be limited to be accessible only from the IP address of the app or users that will control the launcher (TODO maybe we could require user login to manage the launcher; not sure how well that works server-to-server).
8. Review and click Launch.
9. Create a .pem or select one you already have on your workstation. If you create one, be sure to save it, and to `chmod 400` it locally.

We have now launched the server instance and installed Docker on it. The ec2-user-data script should have automatically pulled and installed the rocker-docker app. This takes a few minutes and may be still happening the first time you log in. If you have any trouble with commands, log off the server, wait a few minutes, and then SSH to the server and try again.

To connect to the server, `ssh -i ~/key.pem ubuntu@54.187.229.4` (replace correct key file path and correct IP address of new EC2 instance).

Continue with the necessary docker commands:

```bash
$ docker run --name hipache-npm -p ::6379 -p 80:80 -d ongoworks/hipache-npm
$ docker run -d -v /var/run/docker.sock:/var/run/docker.sock --name launcher --link hipache-npm:hipache -e MONGO_URL="<launcher db connect string>" -e ROOT_URL="http://127.0.0.1" -e PORT="8080" -p ::8080 -i -t ongoworks/rocker-docker 
$ docker pull <reponame>/<app>
```

If all commands are successful, you can see the launcher in your browser by going to:

```
http://<your server address>:8080
```

*Note: Default login is admin/admin*
## Add docker hosts
On the hosts screen, you can manage additional hosts.
For a single server example, where docker apps are launched on the same docker server that is running rocker-docker you can add:

    private host: http://127.0.0.1
    public host: http://127.0.0.1
    port: 4243
    max containers: 100

The private host is the address of the docker server you wish to launch apps on. The public host is the publicly accessible address that will be assigned to hipache - proxy (site) entries. You should always lock down port 4243 on your servers. On AWS, with security groups you can do this by adding the security group id to the custom ip field of a tcp/4243 entry.


## Preparing the Meteor Apps

The launcher runs the other Meteor apps in docker containers as well. You'll need a docker image for each release of each app that you want to run. The launcher can create the docker images for you, but you need to prep the app images.

You need a Dockerfile in the root of your project.  If your project is on github, you can use [Docker.io Trusted Builds](https://index.docker.io/help/docs/#trustedbuilds) to automatically make updated project builds. 
Go to docker.io, register, and go to Trusted Builds and point to your repo.

In the root of your meteor project, add and commit this Dockerfile to your project:

```bash
curl -O https://raw.githubusercontent.com/ongoworks/rocker-docker/master/Dockerfile
```

You can also manually create builds locally.

Install Docker. See: [Getting started with Docker](https://www.docker.io/gettingstarted/)

```bash
cd <yourprojectroot>
docker build --tag="<reponame>/<app>" .
```

To push to docker.io (or elsewhere)
```bash
docker push <reponame>/<app>
```

## Using Rocker-Docker launcher

Once all the prepwork is done, you can use rocker-docker to launch apps.

There are two ways to interact with rocker-docker. You can access it directly in a browser (using the EC2 instance's IP address plus the port, 8080 by default) or you can connect to it through DDP from another Meteor app. To connect from another app, call `var conn = DDP.connect(launcherUrl)` and then `conn.call` the available launcher methods.

    var conn = DDP.connect("http://<rocker-docker-address>:8080")
    var MONGO_URL = "<app mongo url>"
    var hostname =  "<site url>"

    conn.call "launchAppInstance",
        appImage: "<reponame>/<app>",
        mongoUrl: "mongodb://<dbuser>:<dbpass>@<dbhost>:<dbport>/<dbname>",
        hostname:"<www.domain.com>",
        rootUrl: "<site absoluteUrl>"
      env:
        MAIL_URL: "<smtp credentials>"
    , (error, result) ->
      console.log "error in launchAppInstance: " + error if error
      return result


### Build an Image through API

Before you can launch instances of an app, you need to make sure the app's docker image is present on the EC2 server. You can use the Docker.io repo ("Preparing the Meteor Apps"), or you can have one created from a remote Meteor bundle.

```js
Meteor.call("buildImageIfNotExist", "<reponame>/<app>", "http://url-to-your-meteor-bundle/bundle.tar.gz", function () { console.log(arguments); });
```

If an image with that name already exists, nothing happens. Otherwise it will build an image with that name from the tar file URL you provide (which is the one you created in the "Preparing the Meteor Apps" section).

TODO: Building the image takes some time (a few minutes?) and currently this method will return before the building is actually done. Need to figure out a good solution for notifying that the image is built.

### Launch an App Instance

```js
Meteor.call("launchAppInstance", {
    appImage: "<reponame>/<app>",
    mongoUrl: "mongodb://<dbuser>:<dbpass>@<dbhost>:<dbport>/<dbname>",
    hostname:"<www.domain.com>",
    rootUrl: "http://localhost"
  }, function () { console.log(arguments); });
```

Note: If the repo/appname doesn't exist, it will attempt to download from the Docker.io public repo.

The new app instance's ID is returned. If calling from another app, you will want to save this somewhere and use it whenever calling any of the other available methods. This method will add the Hipache/redis entry if the optional hostname is provided.

### Other Methods

TODO Expand on these eventually, but for now here's a list:

* startAppInstance(instanceId)
* restartAppInstance(instanceId)
* stopAppInstance(instanceId)
* killAppInstance(instanceId)
* removeAppInstance(instanceId)
* getContainerInfo(instanceId)
* getEnvironmentVariables(instanceId)
* addHostname(instanceId, hostname)
* removeHostname(instanceId, hostname)
* rebuildAppInstance(instanceId)
* addHost(privateHost,publicHost,port,maxContainers,active)

### TODO

* Buttons and better design on launcher app client
* Dynamic changing of root URL
* Load balancing (currently distributes instantiation)
* Auto scaling hooks to automatically update hosts
* SSL handling
* Support for SSH into docker container
* app instance logs
* Adjust launcher to consume Meteor app bundles directly since the Dockerfile is always the same.
* Stats, e-mailing, etc.
