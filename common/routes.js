// note: problem with redirect after sign-in is an accounts-entry bug
Router.configure({
  notFoundTemplate: 'notFound',
  loadingTemplate: 'loading',
  layoutTemplate: 'layout'
});

Router.onBeforeAction('loading');

Router.map(function() {

  this.route('index', {
    path: '/'
  });

  this.route('dashboard', {
    path: '/dashboard',
    waitOn: function() {
      return [
        Meteor.subscribe("hosts")
      ];
    },
    onBeforeAction: function (pause) {
      AccountsEntry.signInRequired(this, pause);
    }
  });

  this.route('containers', {
    path: '/containers',
    template: 'appInstances',
    waitOn: function() {
      return [
        Meteor.subscribe("appInstancesTable")
      ];
    },
    onBeforeAction: function (pause) {
      AccountsEntry.signInRequired(this, pause);
    }
  });

  this.route('appInstanceDetails', {
    path: 'container/:_id',
    waitOn: function() {
      return [
        Meteor.subscribe("appInstance", this.params._id)
      ];
    },
    data: function () {
      return AppInstances.findOne(this.params._id);
    },
    onBeforeAction: function (pause) {
      AccountsEntry.signInRequired(this, pause);
    }
  });

  this.route("createAppInstance", {
    path: "create_app",
    waitOn: function() {
      return [
        Meteor.subscribe("dockerImages")
      ];
    },
    onBeforeAction: function (pause) {
      AccountsEntry.signInRequired(this, pause);
    }
  });

  this.route('images', {
    waitOn: function() {
      return [
        Meteor.subscribe("dockerImages")
      ];
    },
    data: function () {
      return DockerImages.find({}, {sort: {name: 1}});
    },
    onBeforeAction: function (pause) {
      AccountsEntry.signInRequired(this, pause);
    }
  });

  this.route('hosts', {
    waitOn: function() {
      return [
        Meteor.subscribe("hosts")
      ];
    },
    data: function () {
      return Hosts.find({}, {sort: {'details.Containers': -1}});
    },
    onBeforeAction: function (pause) {
      AccountsEntry.signInRequired(this, pause);
    },
    onAfterAction: function () {
      Meteor.call("host/refreshDetails");
    }
  });

  this.route("settings", {
    waitOn: function() {
      return [ Meteor.subscribe("settings")];
    },
    onBeforeAction: function (pause) {
      AccountsEntry.signInRequired(this, pause);
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
