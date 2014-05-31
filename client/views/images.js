Template.images.images = function () {
  return DockerImages.find({}, {sort: {name: 1}});
};

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