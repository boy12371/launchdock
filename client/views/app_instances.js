AutoForm.addHooks("launchAppInstanceForm", {
  before: {
    "ai/launch": function (doc, template) {
      var newDoc = {
        appImage: doc.dockerImage,
        hostname: doc.hostname,
        env: {}
      };
      _.each(doc.env, function (obj) {
        newDoc.env[obj.name] = obj.value;
      });
      return newDoc;
    }
  },
  onSuccess: function () {
    Router.go("apps");
  }
});

Template.createAppInstance.dockerImageOptions = function () {
  return DockerImages.find().map(function (image) {
    return {label: image.name, value: image.name};
  });
};

Template.appInstances.helpers({
  appInstancesTableQuery: function () {
    var query = {};
    var searchFor = Session.get("appInstanceSearchQuery") || "";
    searchFor = searchFor.split(" ");
    _.each(searchFor, function (term) {
      if (term.length === 0)
        return;

      query.$or = query.$or || [];

      _.each(["image", "containerId", "status", "actualEnv", "hostnames"], function (key) {
        var q = {};
        q[key] = {$regex: term, $options: "i"};
        query.$or.push(q);
      });

      var numTerm = parseInt(term, 10);
      if (!isNaN(numTerm)) {
        _.each(["port", "container.pid"], function (key) {
          var q = {};
          q[key] = numTerm;
          query.$or.push(q);
        });
      }
      
    });
    return query;
  },
  searchTerms: function () {
    return Session.get("appInstanceSearchQuery");
  }
});

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
  },
  'submit #search-form': function (event, template) {
    event.preventDefault();
    var terms = template.$("#searchTerms").val();
    if (typeof terms === "string" && terms.length)
      Session.set("appInstanceSearchQuery", terms);
    else
      Session.set("appInstanceSearchQuery", null);
  },
  'click .clearSearch': function (event, template) {
    event.preventDefault();
    Session.set("appInstanceSearchQuery", null);
  }
};