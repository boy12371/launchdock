// ***
// little helper to locate object in an array
// ***
function containsObject(obj, list) {
 var res = _.find(list, function(val){ return _.isEqual(obj, val)});
 return (_.isObject(res))? true:false;
}


AutoForm.addHooks("launchAppInstanceForm", {
  before: {
    "ai/launch": function (doc, template) {
      var newDoc = {
        appImage: doc.dockerImage,
        hostname: doc.hostname,
        env: {}
      };
      _.each(doc.env, function (obj) {
        newDoc.env[obj.name] = obj.value;
      });
      return newDoc;
    }
  },
  onSuccess: function () {
    Router.go("apps");
  }
});

Template.createAppInstance.dockerImageOptions = function () {
  return DockerImages.find().map(function (image) {
    return {label: image.name, value: image.name};
  });
};

Template.appInstances.helpers({
    AppInstances: function(){
      return AppInstances;
    },
    settings: function () {
      var selectedAppInstances = Session.get('selectedAppInstances') || [];
        return {
            rowsPerPage: 25,
            showFilter: true,
            useFontAwesome: true,
            fields: [
              {'key': 'hostnames', 'label': 'Domain'},
              {'key': 'status', 'label': 'Status'},
              {'key': 'createdAt', 'label': 'Created', 'sort': 'descending'},
              {'key': 'env.METEOR_EMAIL', 'label': 'Contact'},
              {'key': 'image', 'label': 'Docker Image' }
            ],
            rowClass: function(item) {
              if (containsObject({'_id':item._id},selectedAppInstances) ) {
                return "selected"
              }
            }
        };
    }
});

Template.appInstances.events({
  'click .reactive-table tr': function (event,template) {
    selectedAppInstances = Session.get("selectedAppInstances") || [];
    if (containsObject({'_id':this._id},selectedAppInstances) ) {
      selectedAppInstances = _.without(selectedAppInstances, _.findWhere(selectedAppInstances, {'_id':this._id}));
    } else {
      selectedAppInstances.push({'_id':this._id});
    }
    Session.set("selectedAppInstances",selectedAppInstances);
  }
});