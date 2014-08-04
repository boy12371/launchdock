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

// ************************************************************
//  appInstance helpers
//  see: https://github.com/ecohealthalliance/reactive-table
//  for configuration / tables settings
// ************************************************************
Template.appInstances.helpers({
    AppInstances: function(){
      return AppInstances;
    },
    settings: function () {
      var selectedAppInstances = Session.get('selectedAppInstances') || [];
        return {
            rowsPerPage: 20,
            showFilter: true,
            useFontAwesome: true,
            fields: [
              {'key': 'hostnames', 'label': 'Domain',
                fn: function (value,item ) {
                    return new Spacebars.SafeString('<i class="app-detail-icon" data-id="'+item._id+'"></i><a href="http://'+value+'" class="domain-link" target="_blank">'+value+'</a>');
                }
              },
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
  'click .reactive-table tbody tr .app-detail-icon': function (event,template) {
    event.stopPropagation();
    id =  $(event.currentTarget).data().id;
    Router.go("/app/"+id);    //Router.go('app', {_id: id}); //Should work, hmmm?
  },

  'click .reactive-table tbody tr a': function (event,template) {
    event.stopPropagation(); // We don't want to the row selected if we're clicking out to view site.
  },

  'click .reactive-table tbody tr': function (event,template) {
    event.stopPropagation();
    selectedAppInstances = Session.get("selectedAppInstances") || [];
    if (containsObject({'_id':this._id},selectedAppInstances) ) {
      selectedAppInstances = _.without(selectedAppInstances, _.findWhere(selectedAppInstances, {'_id':this._id}));
    } else {
      selectedAppInstances.push({'_id':this._id});
    }
    Session.set("selectedAppInstances",selectedAppInstances);
  }
});