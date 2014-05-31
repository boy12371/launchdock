Meteor.publish("appInstances", function () {
	if (this.userId) {
		return AppInstances.find();
	}
});

Meteor.publish("dockerImages", function () {
	if (this.userId) {
		return DockerImages.find();
	}
});

Meteor.publish("hosts", function () {
	if (this.userId) {
		return Hosts.find();
	}
});