Template.settings.helpers({
  settingsDoc: function() {
    return Settings.findOne();
  },
  containersUsed: function() {
    return AppInstances.find({'userId':Meteor.userId()}).count();
  },
  containersCredit: function() {
    var totalHosts = 0;
    hosts = Hosts.find().fetch();
    _.each(hosts, function(host) {
      totalHosts = totalHosts+host.max;
    });
    return totalHosts;
  }
});