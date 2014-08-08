// small function to delay a little on keypress
var typewatch = (function(){
  var timer = 0;
  return function(callback, ms){
    clearTimeout (timer);
    timer = setTimeout(callback, ms);
  }
})();

//
//  createAppinstance
//
Template.createAppInstance.helpers({
  hubAutocomplete: function () {
    // initially we'll return local existing images, but typeahead search docker hub
    if (Session.equals('hubSearch')) {
      return Session.get('hubSearch') || [];
    } else {
      return DockerImages.find().map(function (image) {
        return {label: image.name, value: image.name};
      });
    }
  },
  appTemplateEnvs: function () {
    if (!Session.equals("appTemplate")) {
      return  Session.get("appTemplate")
    } else {
      return [];
    }

  }
});

AutoForm.addHooks("launchAppInstanceForm", {
  before: {
    "ai/launch": function (doc, template) {
      var newDoc = {
        appImage: doc.dockerImage,
        hostnames: [doc.hostname],
        env: {}
      };
      _.each(doc.env, function (obj) {
        newDoc.env[obj.name] = obj.value;
      });
      return newDoc;
    }
  },
  onSuccess: function (doc,template) {
    $('#appCreateModal').modal('toggle');
    // this.resetForm();
    // Session.set("hubSearch","");
    // Session.set("appTemplate","");
    Router.go("apps");
  }
});

//
//  docker hub autocomplete input template
//
Template["afInput_createAppInstance"].hubAutocomplete = function () {
  return Session.get('hubSearch') || [];
};

Template["afInput_createAppInstance"].rendered = function() {
  Meteor.typeahead('.typeahead');
}

Template.createAppInstance.events({
  'keypress .typeahead': function (event, template) {
    typewatch(function () {
      var query = $(event.currentTarget).val();
      Meteor.call('hub/autocomplete', query, function(err, res){
        var results = res.map(function(s){return s.namespace+"/"+s.name;});
        Session.set('hubSearch', results);
      });
    }, 300);
  },
  'blur.typeahead': function (event, template) {
    var image = $(event.currentTarget).val();
    if (image && image.indexOf('/') != -1) {
      var repository = image.split("/");
      var exists = DockerImages.findOne({'name':image});
      // validate image exists in hub, or locally, provide error
      Meteor.call('hub/getTags',repository[0], repository[1], function (error,results) {
        if (exists && results) {
          Session.set("appTemplate",AppTemplates.findOne({'image':exists.name}));
          alertify.success("Image exists and is ready to use");
        } else if (results) {
          Meteor.call("image/add", image, function (error,results) {
            alertify.log("Image downloading from Docker Hub");
          });
        } else {
          alertify.log("Invalid Docker Hub image.");
        }
      });
    }
  }
});



