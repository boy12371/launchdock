AppInstances = new Meteor.Collection("AppInstances");
AppInstances.attachSchema(Schemas.AppInstance);

DockerImages = new Meteor.Collection("DockerImages");
DockerImages.attachSchema(Schemas.DockerImage);

Hosts = new Meteor.Collection("Hosts");
Hosts.attachSchema(Schemas.Host);

// COLLECTION HELPERS
AppInstances.helpers({
  hosts: function () {
  	return Hosts.find({_id: {$in: this.dockerHosts}}).fetch();
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