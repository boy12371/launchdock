Template.hosts.helpers({
  displayControls: function () {
   if (Meteor.userId() == this.userId || Roles.userIsInRole(Meteor.userId(), ['admin'])) return true
  }
});

Template.hosts.events({
  'click #pause-host': function (event, template) {
    Hosts.update(this._id, {$set:{active: false}})
  },
  'click #start-host': function (event, template) {
    Hosts.update(this._id, {$set:{active: true}})
  },
  'click #delete-host': function (event, template) {
    var self = this;
    alertify.prompt("Input primary address to confirm.", function (e, str) {
        if (e) {
          if (str === self.publicHost) {
            alertify.set({ labels: { ok: "Migrate", cancel : "Deactivate"} });
            alertify.confirm("If there are any app instances on this host, should they be moved to another host? If you click Cancel, they will be deactivated.", function (e) {
                if (e) {
                    alertify.log("Migrating "+self.details.Containers+" containers to new hosts, and removing host "+self.tag)
                    Meteor.call("host/remove", self._id, true);
                } else {
                    alertify.log("Deactivating "+self.details.Containers+" containers and removing host "+self.tag)
                    Meteor.call("host/remove", self._id, false);
                }
            });
            //Reset to normal
            alertify.set({ labels: { ok: "Ok", cancel : "Cancel"} });
          } else {
            alertify.log("Cancelled removing this host. Input didn't match host public IP");
            return false;
          }
        }
    }, "xxx.xxx.xxx.xxx");

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
  },
  chanceTag: function() {
    return Meteor.user().username +"/"+ chance.city().toLowerCase();
  }
});

AutoForm.addHooks("hostInsertForm", {
  after: {
    "host/add": function (error, result, template) {
      if (result === false) {
        alertify.alert("Oops! We couldn't connect to Docker on the private address and port that you entered. Make sure that Docker is running on the server, that it has been set up to accept connections on the port you entered, and that that port is open and accessible from the Launch Dock server.");
      } else {
        Meteor.call("host/refreshDetails");
        alertify.success("Host is available for use.")
      }
    }
  }
});