Template.appInstances.instances = function () {
	return AppInstances.find({}, {sort: {createdAt: -1}});
};

Template.instanceRow.shortContainerId = function () {
	return (this.containerId || "").slice(0, 10);
};

Template.instanceRow.events = {
	'click .start': function (event, template) {
	  Meteor.call("startAppInstance", this._id, function () {
	    console.log("startAppInstance result:", arguments);
	  });
	},
	'click .stop': function (event, template) {
	  Meteor.call("stopAppInstance", this._id, function () {
	    console.log("stopAppInstance result:", arguments);
	  });
	},
	'click .restart': function (event, template) {
	  Meteor.call("restartAppInstance", this._id, function () {
	    console.log("restartAppInstance result:", arguments);
	  });
	},
	'click .kill': function (event, template) {
	  Meteor.call("killAppInstance", this._id, function () {
	    console.log("killAppInstance result:", arguments);
	  });
	},
	'click .remove': function (event, template) {
	  var result = confirm("Are you sure you want to delete this site??");
	  if (result == true) {
	    Meteor.call("removeAppInstance", this._id, function () {
	        console.log("removeAppInstance result:", arguments);
	    });
	  }
	},
	'click .rebuild': function (event, template) {
	  Meteor.call("rebuildAppInstance", this._id, function () {
	    console.log("rebuildAppInstance result:", arguments);
	  });
	},
	'click .info': function (event, template) {
	  Meteor.call("getContainerInfo", this._id, function () {
	    console.log("getContainerInfo result:", arguments);
	  });
	}
};