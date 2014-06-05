Template.hosts.events({
  'click #pause-host': function (event,template) {
    Hosts.update(this._id, {$set:{active: false}})
  },
  'click #start-host': function (event,template) {
    Hosts.update(this._id, {$set:{active: true}})
  },
  'click #delete-host': function (event,template) {
    if (confirm("Really delete this docker host?")) {
      Hosts.remove(this._id);
    }
  }
});