AutoForm.addHooks("launchAppInstanceForm", {
  onSubmit: function (insertDoc, updateDoc, currentDoc) {
    var doc = insertDoc;
    var options = {
      appImage: doc.dockerImage,
      hostname: doc.hostname,
      env: {
        ROOT_URL: doc.rootUrl,
        MONGO_URL: doc.mongoUrl
      }
    };
    _.each(doc.env, function (obj) {
      options.env[obj.name] = obj.value;
    });
    Meteor.call("ai/launch", options, function (error, result) {
      if (error) {
        console.log(error);
      } else {
        AutoForm.resetForm("launchAppInstanceForm");
        Router.go("apps");
      }
    });
    return false; // prevent browser form submission
  }
});

Template.createAppInstance.dockerImageOptions = function () {
  return DockerImages.find().map(function (image) {
    return {label: image.name, value: image.name};
  });
};

Template.appInstances.appInstancesTableQuery = function () {
  return {};
};

function selectedAppInstances(template) {
  var result = [];
  // Get existing, already rendered datatable
  // The package auto-assigns an ID, so we need to find out what it is first
  var id = template.$("#appInstancesTable .dataTables_wrapper").attr("id");
  id = id.replace("_wrapper", "");
  var table = template.$("table#" + id).DataTable();
  // See which rows are selected in it
  table.rows('.selected').data().each(function (rowData) {
    result.push(rowData);
  });
  return result;
}

function logError(error) {
  error && console.log(error);
}

Template.appInstances.events = {
  'click .newAppInstance': function (event, template) {
    Router.go("createAppInstance");
  },
  'click .start': function (event, template) {
    if (!confirm("Start ALL selected sites?")) {
      return;
    }

    _.each(selectedAppInstances(template), function (ai) {
      Meteor.call("ai/start", ai._id, logError);
    });
  },
  'click .stop': function (event, template) {
    if (!confirm("Stop ALL selected sites?")) {
      return;
    }

    _.each(selectedAppInstances(template), function (ai) {
      Meteor.call("ai/stop", ai._id, logError);
    });
  },
  'click .restart': function (event, template) {
    if (!confirm("Restart ALL selected sites?")) {
      return;
    }

    _.each(selectedAppInstances(template), function (ai) {
      Meteor.call("ai/restart", ai._id, logError);
    });
  },
  'click .kill': function (event, template) {
    if (!confirm("Kill ALL selected sites?")) {
      return;
    }

    _.each(selectedAppInstances(template), function (ai) {
      Meteor.call("ai/kill", ai._id, logError);
    });
  },
  'click .remove': function (event, template) {
    // Confirm deletion
    if (!confirm("Delete ALL selected sites?")) {
      return;
    }

    // If confirmed, then remove all.
    _.each(selectedAppInstances(template), function (ai) {
      Meteor.call("ai/remove", ai._id, logError);
    });
  },
  'click .rebuild': function (event, template) {
    if (!confirm("Rebuild ALL selected sites?")) {
      return;
    }

    _.each(selectedAppInstances(template), function (ai) {
      Meteor.call("ai/rebuild", ai._id, logError);
    });
  },
  'click .rebuild-all': function (event, template) {
    if (!confirm("Rebuild ALL sites (not just those selected)?")) {
      return;
    }

    Meteor.call("ai/rebuildAll", logError);
  },
  'click .deactivate': function (event, template) {
    if (!confirm("Deactivate ALL selected sites?")) {
      return;
    }

    _.each(selectedAppInstances(template), function (ai) {
      Meteor.call("ai/deactivate", ai._id, logError);
    });
  },
  'click .activate': function (event, template) {
    if (!confirm("Activate ALL selected sites?")) {
      return;
    }

    _.each(selectedAppInstances(template), function (ai) {
      Meteor.call("ai/activate", ai._id, function (error, result) {
        if (error)
          console.log(error);
        else if (!result)
          console.log("Failed to activate app instance " + ai._id + ". Perhaps you have not defined any hosts or a host is down.");
      });
    });
  }
};