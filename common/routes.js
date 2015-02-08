// Patch for broken accounts-entry AccountsEntry.signInRequired(this);
// https://github.com/Differential/accounts-entry/issues/341
signInRequired = function(router, extraCondition) {
  if (extraCondition == null) {
    extraCondition = true;
  }
  if (!Meteor.loggingIn()) {
    if (!Meteor.user() || !extraCondition) {
      Session.set('fromWhere', router.url);
      Router.go('/sign-in');
      return Session.set('entryError', t9n('error.signInRequired'));
    } else {
      Meteor.call("host/refreshDetails");
      return router.next();
    }
  }
}

// Declare Route Defaults
Router.configure({
  notFoundTemplate: 'notFound',
  loadingTemplate: 'loading',
  layoutTemplate: 'layout'
});

// Create Router Mapping
Router.map(function() {

  this.route('index', {
    path: '/'
  });

  this.route('dashboard', {
    path: '/dashboard',
    waitOn: function() {
      return Meteor.subscribe("hosts")
    },
    subscriptions: function () {
      return Meteor.subscribe("appInstancesTable")
    },
    onBeforeAction: function () {
      signInRequired(this);
    }
  });

  this.route('containers', {
    path: '/containers',
    template: 'appInstances',
    waitOn: function() {
      return Meteor.subscribe("appInstancesTable");
    },
    onBeforeAction: function () {
      signInRequired(this);
    }
  });

  this.route('appInstanceDetails', {
    path: 'container/:_id',
    waitOn: function() {
      Meteor.subscribe("appInstance", this.params._id)
    },
    data: function () {
      return AppInstances.findOne(this.params._id);
    },
    onBeforeAction: function () {
      signInRequired(this);
    }
  });

  this.route("createAppInstance", {
    path: "create_app",
    waitOn: function() {
      Meteor.subscribe("dockerImages");
    },
    onBeforeAction: function () {
      signInRequired(this);
    }
  });

  this.route('images', {
    waitOn: function() {
      Meteor.subscribe("dockerImages");
    },
    data: function () {
      return DockerImages.find({}, {sort: {name: 1}});
    },
    onBeforeAction: function () {
      signInRequired(this);
    }
  });

  this.route('hosts', {
    waitOn: function() {
      Meteor.subscribe("hosts");
    },
    data: function () {
      return Hosts.find({}, {sort: {'details.Containers': -1}});
    },
    onBeforeAction: function () {
      signInRequired(this);
    }
  });

  this.route("settings", {
    waitOn: function() {
      return Meteor.subscribe("settings");
    },
    onBeforeAction: function () {
      signInRequired(this);
    }
  });

  this.route('notFound', {
    path: "/(.*)"
  });

});

// Active pages
if (Meteor.isClient) {
  UI.registerHelper("currentPageIs", function (name) {
    var current = Router.current();
    return current && current.route.name === name;
  });
}
