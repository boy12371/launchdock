AppInstances = new Meteor.Collection("AppInstances");
AppInstances.attachSchema(Schemas.AppInstance);

DockerImages = new Meteor.Collection("DockerImages");
DockerImages.attachSchema(Schemas.DockerImage);

Hosts = new Meteor.Collection("Hosts");
Hosts.attachSchema(Schemas.Host);

// COLLECTION HELPERS
