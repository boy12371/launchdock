Template.imageProgressBar.helpers({
  imageStatus: function () {
    if (Session.equals('imageSelected')) return null;
    image = DockerImages.findOne({'name':Session.get('imageSelected')});
    if (image) {
      var status = image.status;
      if (status == "Downloaded") {
        return Template.imageDownloaded;
      } else if (status == "Pending") {
        return Template.imagePending;
      } else {
        return Template.imageProgress;
      }
    } else {
      return null;
    }
  },

  hubAutocomplete: function () {
    // initially we'll return local existing images, but typeahead search docker hub
    if (Session.equals('hubSearch')) {
      return Session.get('hubSearch') || [];
    } else {
      return DockerImages.find().map(function (image) {
        return {label: image.name, value: image.name};
      });
    }
  }
});

Template.imageProgress.helpers({
  imageSelected: function () {
    return Session.get('imageSelected');
  }
});

Template.imageProgress.rendered = function () {
  $('.btn-launch-instance').toggleClass('disabled');
};

Template.imageProgress.destroyed = function () {
  $('.btn-launch-instance').toggleClass('disabled');
};