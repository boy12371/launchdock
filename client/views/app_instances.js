AutoForm.addHooks("launchAppInstanceForm", {
	onSubmit: function (insertDoc, updateDoc, currentDoc) {
		var doc = insertDoc;
		var options = {
			appImage: doc.dockerImage,
			mongoUrl: doc.mongoUrl,
			rootUrl: doc.rootUrl,
			hostname: doc.hostname,
			env: {}
		};
		_.each(doc.env, function (obj) {
			options.env[obj.name] = obj.value;
		});
		Meteor.call("ai/launch", options, function (error, result) {
			if (error) {
				console.log(error);
			} else {
				AutoForm.resetForm("launchAppInstanceForm");
			}
		});
		return false; // prevent browser form submission
	}
});

Template.appInstances.dockerImageOptions = function () {
	return DockerImages.find().map(function (image) {
		return {label: image.name, value: image.name};
	});
};

Template.appInstances.appInstancesTableQuery = function () {
	return {};
};

Template.instanceRow.definedEnv = function () {
	return _.map(this.env, function (val, name) {
		return name + "=" + val;
	});
};

Template.instanceRow.shortContainerId = function () {
	return (this.containerId || "").slice(0, 10);
};

Template.instanceRow.events = {
	'click .start': function (event, template) {
	  Meteor.call("ai/start", this._id, function () {
	    console.log("ai/start result:", arguments);
	  });
	},
	'click .stop': function (event, template) {
	  Meteor.call("ai/stop", this._id, function () {
	    console.log("ai/stop result:", arguments);
	  });
	},
	'click .restart': function (event, template) {
	  Meteor.call("ai/restart", this._id, function () {
	    console.log("ai/restart result:", arguments);
	  });
	},
	'click .kill': function (event, template) {
	  Meteor.call("ai/kill", this._id, function () {
	    console.log("ai/kill result:", arguments);
	  });
	},
	'click .remove': function (event, template) {
	  if (this.status !== "stopped") {
	  	alert("Stop or kill it before deleting it.");
	  	return;
	  }
	  var result = confirm("Are you sure you want to delete this site??");
	  if (result == true) {
	    Meteor.call("ai/remove", this._id, function () {
	        console.log("ai/remove result:", arguments);
	    });
	  }
	},
	'click .rebuild': function (event, template) {
	  Meteor.call("ai/rebuild", this._id, function () {
	    console.log("ai/rebuild result:", arguments);
	  });
	},
	'click .info': function (event, template) {
	  Meteor.call("ai/getContainerInfo", this._id, function (error, result) {
	    console.log("ai/getContainerInfo result:", result);
	  });
	}
};