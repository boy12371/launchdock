function logError(error) {
  error && console.log(error);
}

Template.instanceHeader.helpers({
  selectedAppInstancesCount: function () {
    var selectedAppInstances = Session.get("selectedAppInstances") || [];
    return selectedAppInstances.length;
  }
});

Template.instanceHeader.events = {
  'click .newAppInstance': function (event, template) {
    $('#appCreateModal').modal('toggle');
  },
  'click .clear-all': function (event, template) {
    Session.set("selectedAppInstances",[]);
    $('.reactive-table tr').removeClass('selected');
  },
  'click .select-all': function (event, template) {
    var selectedAppInstances = Session.get("selectedAppInstances") || [];
    instances = AppInstances.find().fetch();

    _.each(instances, function (ai) {
      selectedAppInstances.push({'_id':ai._id})
    });
    Session.set("selectedAppInstances",selectedAppInstances);
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
    alertify.confirm("Stop selected sites?", function (e) {
        var count = 0;
        if (e) {
          _.each(Session.get("selectedAppInstances"), function (ai) {
            Meteor.call("ai/stop", ai._id, logError);
            count ++
          });
        }
        alertify.success("Stopping "+count+" containers");
    });

  },
  'click .restart': function (event, template) {
    alertify.confirm("Restart selected sites?", function (e) {
        if (e) {
        _.each(Session.get("selectedAppInstances"), function (ai) {
          Meteor.call("ai/restart", ai._id, logError);
        });
        }
    });
  },
  'click .kill': function (event, template) {
    alertify.confirm("Kill and delete containers for selected sites?", function (e) {
      if (e) {
        _.each(Session.get("selectedAppInstances"), function (ai) {
          Meteor.call("ai/kill", ai._id, logError);
        });
      }
    });
  },
  'click .remove': function (event, template) {
    alertify.confirm("PERMANENTLY DELETE RECORDS AND CONTAINER FOR SELECTED SITES?", function (e) {
      if (e) {
        removeInstances = Session.get('selectedAppInstances')
        _.each(removeInstances, function (ai) {
          Meteor.call("ai/remove", ai._id, logError, function(error,result) {
            var selectedAppInstances = Session.get('selectedAppInstances')
            selectedAppInstances = _.without(selectedAppInstances, _.findWhere(selectedAppInstances, {'_id':result}));
            alertify.success("Removed: "+result)
            Session.set('selectedAppInstances',selectedAppInstances)
          });
        });
      }
    });
  },
  'click .rebuild': function (event, template) {
    alertify.confirm("Rebuild selected sites?", function (e) {
        if (e) {
        _.each(Session.get("selectedAppInstances"), function (ai) {
          Meteor.call("ai/rebuild", ai._id, logError);
        });
        }
    });
  },
  'click .rebuild-all': function (event, template) {
    if (!confirm("Rebuild ALL sites (not just those selected)?")) {
      return;
    }

    Meteor.call("ai/rebuildAll", logError);
  },
  'click .deactivate': function (event, template) {
    alertify.confirm("Deactivate selected sites?", function (e) {
        if (e) {
        _.each(Session.get("selectedAppInstances"), function (ai) {
          Meteor.call("ai/deactivate", ai._id, logError);
        });
        }
    });
  },
  'click .activate': function (event, template) {
    alertify.confirm("Activate selected sites?", function (e) {
        if (e) {
          _.each(Session.get("selectedAppInstances"), function (ai) {
            Meteor.call("ai/activate", ai._id, function (error, result) {
              if (error)
                console.log(error);
              else if (!result)
                console.log("Failed to activate app instance " + ai._id + ". Perhaps you have not defined any hosts or a host is down.");
            });
          });
        }
    });
  }
};
