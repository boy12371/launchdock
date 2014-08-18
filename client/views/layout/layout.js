Template.layout.helpers({
  totalInstances: function () {
    if (this.tag) {
      return this.tag;
    } else {
      return this._id;
    }
  },
  totalInstances: function () {
    return AppInstances.find().count();
  },
  runningInstances: function () {
    return AppInstances.find({'status':'running','dockerHosts':this._id}).count() || 0;
  },
  pausedInstances: function () {
    return AppInstances.find({'status':'stopped','dockerHosts':this._id}).count() || 0;
  },
  runningHosts: function () {
    return Hosts.find({'active':true});
  },
  userHosts: function () {
    return Hosts.find({'userId':Meteor.userId()}).count() || 0;
  },
  totalHosts: function () {
    return Hosts.find().count();
  }
});