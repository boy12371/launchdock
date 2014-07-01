Template.hosts.events({
  'click #pause-host': function (event, template) {
    Hosts.update(this._id, {$set:{active: false}})
  },
  'click #start-host': function (event, template) {
    Hosts.update(this._id, {$set:{active: true}})
  },
  'click #delete-host': function (event, template) {
    if (confirm("Really delete this docker host?")) {
      Meteor.call("host/remove", this._id, confirm("If there are any app instances on this host, should they be moved to another host? If you click Cancel, they will be deactivated."));
    }
  },
  'click #refresh-hosts': function (event, template) {
    Meteor.call("host/refreshDetails");
  }
});

Template.hosts.helpers({
  createdAtFormatted: function () {
    return moment(this.createdAt).format("LLL");
  },
  shortId: function () {
    return this.id.slice(0, 8) + "...";
  },
  virtualSizeFormatted: function () {
    return numeral(this.virtualSize).format('0.000 b');
  }
});