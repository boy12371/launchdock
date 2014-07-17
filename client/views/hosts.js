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

AutoForm.addHooks("hostInsertForm", {
  after: {
    "host/add": function (error, result, template) {
      if (result === false) {
        alert("Oops! We couldn't connect to Docker on the private address and port that you entered. Make sure that Docker is running on the server, that it has been set up to accept connections on the port you entered, and that that port is open and accessible from the Rocker Docker server.");
      }
    }
  }
});