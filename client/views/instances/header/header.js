function logError(error) {
  error && console.log(error);
}

Template.instanceHeader.events = {
  'click .newAppInstance': function (event, template) {
    Router.go("createAppInstance");
  },
  'click .clear-selected': function (event, template) {
    Session.set("selectedAppInstances",[]);
    $('.reactive-table tr').removeClass('selected');
  },
  'click .start': function (event, template) {
    if (!confirm("Start ALL selected sites?")) {
      return;
    }

    _.each(Session.get("selectedAppInstances"), function (ai) {
      Meteor.call("ai/start", ai._id, logError);
    });
  },
  'click .stop': function (event, template) {
    if (!confirm("Stop ALL selected sites?")) {
      return;
    }

    _.each(Session.get("selectedAppInstances"), function (ai) {
      Meteor.call("ai/stop", ai._id, logError);
    });
  },
  'click .restart': function (event, template) {
    if (!confirm("Restart ALL selected sites?")) {
      return;
    }

    _.each(Session.get("selectedAppInstances"), function (ai) {
      Meteor.call("ai/restart", ai._id, logError);
    });
  },
  'click .kill': function (event, template) {
    if (!confirm("Kill ALL selected sites?")) {
      return;
    }

    _.each(Session.get("selectedAppInstances"), function (ai) {
      Meteor.call("ai/kill", ai._id, logError);
    });

  },
  'click .remove': function (event, template) {
    // Confirm deletion
    if (!confirm("Delete ALL selected sites?")) {
      return;
    }

    // If confirmed, then remove all.
    _.each(Session.get("selectedAppInstances"), function (ai) {
      Meteor.call("ai/remove", ai._id, logError);
    });
  },
  'click .rebuild': function (event, template) {
    if (!confirm("Rebuild ALL selected sites?")) {
      return;
    }

    _.each(Session.get("selectedAppInstances"), function (ai) {
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

    _.each(Session.get("selectedAppInstances"), function (ai) {
      Meteor.call("ai/deactivate", ai._id, logError);
    });
  },
  'click .activate': function (event, template) {
    if (!confirm("Activate ALL selected sites?")) {
      return;
    }

    _.each(Session.get("selectedAppInstances"), function (ai) {
      Meteor.call("ai/activate", ai._id, function (error, result) {
        if (error)
          console.log(error);
        else if (!result)
          console.log("Failed to activate app instance " + ai._id + ". Perhaps you have not defined any hosts or a host is down.");
      });
    });
  }
};