AppInstances = new Meteor.Collection("AppInstances");
AppInstances.attachSchema(Schemas.AppInstance);

DockerImages = new Meteor.Collection("DockerImages");
DockerImages.attachSchema(Schemas.DockerImage);

Hosts = new Meteor.Collection("Hosts");
Hosts.attachSchema(Schemas.Host);

Settings = new Meteor.Collection("Settings");
Settings.attachSchema(Schemas.Settings);

AppTemplates = new Meteor.Collection("AppTemplates");
Settings.attachSchema(Schemas.AppTemplate);

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
  createdAtLong: function () {
  	return moment(this.createdAt).format("LLLL");
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