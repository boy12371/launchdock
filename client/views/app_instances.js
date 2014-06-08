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
		Meteor.call("launchAppInstance", options, function (error, result) {
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
	  if (this.status !== "stopped") {
	  	alert("Stop or kill it before deleting it.");
	  	return;
	  }
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
	  Meteor.call("getContainerInfo", this._id, function (error, result) {
	    console.log("getContainerInfo result:", result);
	  });
	}
};