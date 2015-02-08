// ************************************************************
// little helper to locate object in an array
// ************************************************************

function containsObject(obj, list) {
 var res = _.find(list, function(val){ return _.isEqual(obj, val)});
 return (_.isObject(res))? true:false;
}

// ************************************************************
// make random tag colors from string
// ************************************************************

function stringToColor(str) {
    for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));
    for (var i = 0, color = "#"; i < 3; color += ("00" + ((hash >> i++ * 8) & 0xFF).toString(16)).slice(-2));
    return color;
}

// ************************************************************
//  appInstance helpers
//  see: https://github.com/ecohealthalliance/reactive-table
//  for configuration / tables settings
// ************************************************************

Template.appInstances.helpers({
    settings: function () {
        return {
            collection: AppInstances,
            rowsPerPage: 20,
            showFilter: true,
            fields: [
              {'key': 'env.tag', 'label': 'Env/Tag', 'sortByValue': true,
                fn: function (value,item ) {
                    var tag = "";
                    if (value) {
                      var bgcolor = stringToColor(value)
                      var tag = '<span class="label" style="background-color:'+bgcolor+'">'+value+'</span>';
                    }
                    return new Spacebars.SafeString('<i class="app-detail-icon fa fa-cog" data-id="'+item._id+'"></i>'+tag);
                }
              },
              {'key': 'hostnames', 'label': 'Domain','sortByValue': true,
                fn: function (value,item ) {
                    return new Spacebars.SafeString('<a href="//'+value+'" class="domain-link" target="_blank">'+value+'</a>');
                }
              },
              {'key': 'status', 'label': 'Status'},
              {'key': 'createdAt', 'label': 'Created','sortByValue': true, 'sort': 'descending',
                fn: function(value,item) {
                  return moment(value).tz("America/Los_Angeles").format('MM/DD/YY h:mm a');
                }
              },
              {'key': 'env.METEOR_EMAIL', 'label': 'Contact'},
              {'key': 'image', 'label': 'Docker Image' }

            ],
            rowClass: function(item) {
              var selectedAppInstances = Session.get('selectedAppInstances') || [];
              if (containsObject({'_id':item._id},selectedAppInstances) ) {
                return "selected"
              }
            }
        };
    }
});

// ************************************************************
// Template events
// ************************************************************

Template.appInstances.events({
  'click .reactive-table tbody tr .app-detail-icon': function (event,template) {
    event.stopPropagation();
    id =  $(event.currentTarget).data().id;
    Router.go("/container/"+id);    //Router.go('app', {_id: id}); //Should work, hmmm?
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
