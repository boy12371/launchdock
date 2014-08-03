Meteor.publish("appInstance", function (id) {
  if (Roles.userIsInRole(this.userId, ['admin'])) {
    return AppInstances.find({_id: id}, {limit: 1});
  } else if (this.userId) {
    return AppInstances.find({_id: id,'userId': this.userId}, {limit: 1});
  } else {
    return [];
  }
});

Meteor.publish("dockerImages", function () {
  if (Roles.userIsInRole(this.userId, ['admin'])) {
    return DockerImages.find();
  } else if (this.userId) {
		return DockerImages.find({ $or: [{'userId': this.userId}, {shared: true}]});
	} else {
    return [];
  }
});

Meteor.publish("hosts", function () {
  if (Roles.userIsInRole(this.userId, ['admin'])) {
    return Hosts.find();
  } else if (this.userId) {
		return Hosts.find({ $or: [{'userId': this.userId}, {shared: true}]});
	} else {
    return [];
  }
});

Meteor.publish("appInstances", function () {
  if (Roles.userIsInRole(this.userId, ['admin'])) {
    return AppInstances.find();
  } else if (this.userId) {
    return AppInstances.find({'userId': this.userId});
  } else {
    return [];
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