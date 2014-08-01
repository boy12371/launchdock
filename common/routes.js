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

  this.route('appInstanceDetails', {
    path: 'app/:_id',
    waitOn: function() {
      return [
        Meteor.subscribe("appInstance", this.params._id)
      ];
    },
    data: function () {
      return AppInstances.findOne(this.params._id);
    }
  });

  this.route("createAppInstance", {
    path: "create_app",
    waitOn: function() {
      return [
        Meteor.subscribe("dockerImages")
      ];
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
      Meteor.call("host/refreshDetails");
    }
  });

  this.route('settings');
});

// ******************************************
// Collection Pagination
// uses: https://github.com/alethes/meteor-pages
// creates routing and pagination
// ******************************************
var fields;

fields = ["hostnames", "status", "createdAt","image"];

Pages = new Meteor.Pagination( AppInstances, {
  router: "iron-router",
  route: "/apps/",
  routerTemplate: 'appInstances',
  templateName: "appInstances",
  fastRender: true,
  homeRoute: "apps",
  // infinite: true, //just comment out for pagination
  perPage: 20,
  dataMargin: 5,
  itemTemplate: "instanceRowItem",
  table: {
    "class": "table",
    fields: fields,
    header: _.map(fields, function(f) {
      return f[0].toUpperCase() + f.slice(1);
    }),
    wrapper: "table-wrapper"
  }
});





// Active pages
if (Meteor.isClient) {
  UI.registerHelper("currentPageIs", function (name) {
    var current = Router.current();
    return current && current.route.name === name;
  });
}