Template.imageProgressBar.helpers({
  imageStatus: function () {
    var self = this;
    if (typeof self.name === "undefined") { return null };
    if (self) image = DockerImages.findOne(self);
    if (image) {
      var status = image.status;
      if (status == "Downloaded") {
        return Template.imageDownloaded
      } else {
        return Template.imageProgress;
      }
    } else {
      return null;
    }
  }
});

Template.imageProgress.rendered = function () {
  $('.btn-launch-instance').toggleClass('disabled');
};

Template.imageProgress.destroyed = function () {
  $('.btn-launch-instance').toggleClass('disabled');
};