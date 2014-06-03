Meteor.call("updateHostDetails");

Template.hosts.helpers({
  hosts: function() {
    var hosts = Hosts.find().fetch();
    return hosts;
  }
});

Template.hosts.events({
  'submit form': function (event,template) {
    event.preventDefault();
    host = $('#container-host').val() || "http://127.0.0.1";
    max = $('#container-max').val() || 100;
    port = $('#container-port').val() || 4243;

    Hosts.insert({host:host, port:port, max: max, active: true})
  },
  'click #pause-host': function (event,template) {
    Hosts.update(this._id, {$set:{active: false}})
  },
  'click #start-host': function (event,template) {
    Hosts.update(this._id, {$set:{active: true}})
  }

});