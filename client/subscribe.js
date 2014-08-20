Meteor.subscribe("hosts");
Meteor.subscribe("dockerImages");
Meteor.subscribe("appTemplates");
//Maybe bad form, but we're using this almost everywhere now.
Meteor.subscribe("appInstances");
