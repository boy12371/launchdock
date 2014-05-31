Meteor.publish("appInstances", function () {
	return AppInstances.find();
});

Meteor.publish("dockerImages", function () {
	return DockerImages.find();
});