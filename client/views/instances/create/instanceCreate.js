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
  imageSelected: function () {
    return Session.get('imageSelected');
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
  },
  appTemplateEnvs: function () {
    var doc = []
    if (!Session.equals("imageSelected")) {
      templates = AppTemplates.findOne({'image':Session.get('imageSelected')});
      if (templates) return templates
      // return tag as a suggested env
      var tag = Meteor.user().username +"/"+ chance.word().toLowerCase();
      return {env: [{"name":"tag", "value": tag}] };
    }
  },
  imageStatus: function() {
    if (!Session.equals("imageSelected")) {
      var status = DockerImages.findOne({'name':Session.get('imageSelected')}).status;
      if (status == "Downloaded") {
        return 100;
      } else {
        return status;
      }

    } else {
      return false
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
  onSuccess: function (doc, template) {
    $('#appCreateModal').modal('toggle');
    $('#launchAppInstanceForm').find("input[type=text]").val(""); // couldn't get resetForm to work. eg: AutoForm.resetForm('launchAppInstanceForm')
    Session.set('imageSelected');
    Router.go("apps");
  }
});

Template.createAppInstance.events({
  'click #btn-launch-close': function(event,template) {
    Session.set('imageSelected');
    $('#launchAppInstanceForm').find("input[type=text]").val(""); // couldn't get resetForm to work.
  },
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
          Session.set("imageSelected",image);
          alertify.success("Image exists and is ready to use");
        } else if (results) {
          Meteor.call("image/add", image, function (error,results) {
            Session.set("imageSelected",image);
            Meteor.call('image/status',image);
          });
        } else {
          alertify.log("Invalid Docker Hub image.");
        }
      });
    }
  }
});

