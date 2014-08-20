Template.dashboard.helpers({
  userHosts: function () {
    return Hosts.find({'userId':Meteor.userId()}).count() || 0;
  }
});
