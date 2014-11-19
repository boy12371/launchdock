UI.body.helpers({
  totalInstances: function () {
    if (this.tag) {
      return this.tag;
    } else {
      return this._id;
    }
  },
  runningInstances: function () {
    return AppInstances.find({'status':'running','dockerHosts':this._id}).count() || 0;
  },
  pausedInstances: function () {
    return AppInstances.find({'status':'stopped','dockerHosts':this._id}).count() || 0;
  }
});
