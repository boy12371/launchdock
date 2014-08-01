Template.dashboard.helpers({
  totalInstances: function () {
    return AppInstances.find().count();
  },
  runningInstances: function () {
    return AppInstances.find({'status':'running'}).count();
  },
  pausedInstances: function () {
    return AppInstances.find({'status':'stopped'}).count();
  },
  runningHosts: function () {
    return Hosts.find({'active':true});
  },
  totalHosts: function () {
    return Hosts.find().count();
  }
});