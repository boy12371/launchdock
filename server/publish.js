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

Hosts.allow({
  insert: function () {
      return true;
  },
  remove: function (){
      return true;    
  },
  update: function() {
      return true;    
  }
});