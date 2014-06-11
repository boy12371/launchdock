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
        Meteor.subscribe("appInstances"),
        Meteor.subscribe("dockerImages")
      ];
    },
    data: function () {
      // return AppInstances.find({}, {sort: {createdAt: -1}});
      
      // Get columns from schema
      var ss = AppInstances.simpleSchema();

      return {
        columns: [
          {title: ss.label("host"), data: "host"},
          {title: ss.label("port"), data: "port"},
          {title: ss.label("image"), data: "image"},
          {
            title: ss.label("containerId"),
            data: "containerId",
            mRender: function (data, type, ai) {
              return (ai.containerId || "").slice(0, 10) + "...";
            }
          },
          {
            title: ss.label("createdAt"),
            data: "createdAt",
            mRender: function (data, type, ai) {
              return moment(ai.createdAt).format("LLL");
            }
          },
          {title: ss.label("status"), data: "status"},
          {
            title: ss.label("env"),
            data: "env",
            mRender: function (data, type, ai) {
              var lines = _.map(ai.env, function (val, name) {
                return name + "=" + val;
              });
              return lines.join("<br>");
            }
          },
          {
            title: ss.label("actualEnv"),
            data: "actualEnv",
            mRender: function (data, type, ai) {
              return (ai.actualEnv || []).join("<br>");
            }
          },
          {
            title: ss.label("docker"),
            data: "docker",
            mRender: function (data, type, ai) {
              var lines = _.map(ai.docker, function (val, key) {
                return "<strong>" + key + ":</strong> " + val;
              });
              return lines.join("<br>");
            }
          },
          {title: ss.label("hostnames"), data: "hostnames"},
          {title: ss.label("dockerHosts"), data: "dockerHosts"}
        ],
        options: {
          order: [4, "desc"],
          scrollY: 400,
          scrollX: true
        }
      };
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