Template.imageRow.events = {
  'click .remove': function (event, template) {
    Meteor.call("removeImage", this._id, function () {
      console.log("removeImage result:", arguments);
    });
  },
  'click .create': function () {
    Meteor.call("createImageOnAllHosts", this._id, function () {
      console.log("createImageOnAllHosts result:", arguments);
    });
  }
};

AutoForm.addHooks("addDockerImageForm", {
  onSubmit: function (insertDoc, updateDoc, currentDoc) {
    var d = insertDoc;
    if (d.inRepo) {
      Meteor.call("addImage", d.name, function () {
        console.log("addImage result:", arguments);
      });
    } else {
      Meteor.call("addImageFromArchive", d.name, d.tarUrl, function () {
        console.log("addImageFromArchive result:", arguments);
      });
    }
    return false; // prevent browser form submission
  }
});