Router.configure({
  notFoundTemplate: 'notFound',
  loadingTemplate: 'loading',
  layoutTemplate: 'layout'
});

Router.onBeforeAction('loading');

function requireAuthentication(pause) {
  if (Meteor.loggingIn()) {
    this.render('loading');
    pause();
  } else {
    if (!Meteor.user()) {
      this.render('login');
      pause();
    }
  }
}

Router.onBeforeAction(requireAuthentication);

Router.map(function() {
  this.route('dashboard', {
    path: '/'
  });

  this.route('apps', {
  	template: 'appInstances',
    waitOn: function() {
      return [
        Meteor.subscribe("appInstances")
      ];
    },
    data: function () {
      return AppInstances.find({}, {sort: {createdAt: -1}});
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
    onAfterAction: function () {
      Meteor.call("updateHostDetails");
    }
  });

  this.route('settings');
});

if (Meteor.isClient) {
  UI.registerHelper("currentPageIs", function (name) {
    var current = Router.current();
    return current && current.route.name === name;
  });
}