Template.imageRow.events = {
  'click .remove': function (event, template) {
    Meteor.call("removeImage", this._id, function () {
      console.log("removeImage result:", arguments);
    });
  },
  'click .info': function (event, template) {
    Meteor.call("getImageInfo", this._id, function () {
      console.log("getImageInfo result:", arguments);
    });
  }
};