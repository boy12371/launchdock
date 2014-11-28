AppInstances = new Mongo.Collection("AppInstances");
AppInstances.attachSchema(Schemas.AppInstance);

DockerImages = new Mongo.Collection("DockerImages");
DockerImages.attachSchema(Schemas.DockerImage);

Hosts = new Mongo.Collection("Hosts");
Hosts.attachSchema(Schemas.Host);

Settings = new Mongo.Collection("Settings");
Settings.attachSchema(Schemas.Settings);

AppTemplates = new Mongo.Collection("AppTemplates");
AppTemplates.attachSchema(Schemas.AppTemplate);

//
// COLLECTION HELPERS
// see: https://github.com/dburles/meteor-collection-helpers
//
AppInstances.helpers({
  hosts: function () {
    var dockerHosts = this.dockerHosts || [];
  	return Hosts.find({_id: {$in: dockerHosts}}).fetch();
  },
  envAsArray: function () {
  	return _.map(this.env, function (val, key) {
  		return key + "=" + val;
  	});
  },
  portsAsArray: function () {
    return _.map(this.info.NetworkSettings.Ports, function (val, key) {
      return key + " => " + val[0].HostPort;
    });
  },
  createdAtLong: function () {
  	return moment(this.createdAt).format("LLLL");
  },
  createdAtShort: function () {
    return moment(this.createdAt).tz("America/Los_Angeles").format('MM/DD/YY h:mm a');
  },
  shortContainerId: function () {
    return (this.containerId || "").slice(0, 10) + '...';
  }
});

//
// COLLECTION HOOKS
// see: https://github.com/matb33/meteor-collection-hooks
//
AppInstances.before.insert(function (userId, doc) {
  doc.userId = Meteor.userId();
  var env = [];
  // STORE ENV KEY/NAME FOR VAR TEMPLATING FOR NEW INSTANCES
  appDefaults = AppTemplates.findOne({'image': doc.image});
  if (!appDefaults && doc.env) {
    _.each(doc.env, function(value,key) {
      env.push({"name":key, "value": ""});
    });
    AppTemplates.insert({image: doc.image,env: env})
  }
  // TODO: UPDATE EXISTING WITH NEW VARIABLES
});

DockerImages.before.insert(function (userId, doc) {
  doc.userId = Meteor.userId();
});

Hosts.before.insert(function (userId, doc) {
  doc.userId = Meteor.userId();
});

Settings.before.insert(function (userId, doc) {
  doc.userId = Meteor.userId();
});
