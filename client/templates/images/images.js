Template.imageRow.helpers({
  imageInUse: function () {
    return AppInstances.findOne({'image':this.name});
  }
});

Template.imageRow.events = {
  'click .remove': function (event, template) {
    if (confirm("Really delete this image from this list and from all hosts?")) {
      Meteor.call("image/remove", this._id, function () {
        console.log("image/remove result:", arguments);
      });
    }
  },
  'click .create': function () {
    Meteor.call("image/createOnAllHosts", this._id, function () {
      console.log("image/createOnAllHosts result:", arguments);
    });
  }
};

AutoForm.addHooks("addDockerImageForm", {
  onSubmit: function (insertDoc, updateDoc, currentDoc) {
    var self = this;
    var d = insertDoc;
    if (d.inRepo) {
      Meteor.call("image/add", d.name, function () {
        console.log("image/add result:", arguments);
        self.done();
      });
    } else {
      Meteor.call("image/addFromArchive", d.name, d.tarUrl, function () {
        console.log("image/addFromArchive result:", arguments);
        self.done();
      });
    }
    return false; // prevent browser form submission
  }
});