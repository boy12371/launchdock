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
        Meteor.subscribe("dockerImages")
      ];
    },
    data: function () {
      return {
        columns: [
          {
            title: "Created",
            data: "createdAt",
            mRender: function (data, type, ai) {
              return moment(ai.createdAt).format("YYYY-MM-DD HH:mm");
            },
            width: "100px",
            defaultContent: "Unknown"
          },
          {
            title: "Host",
            mRender: function (data, type, ai) {
              if (!ai.containerId)
                return "DEACTIVATED";
              // currently each app instance will only be on one host
              var hostString = "";
              var dockerHosts = ai.dockerHosts || [];
              Hosts.find({_id: {$in: dockerHosts}}).forEach(function (host) {
                hostString = host.privateHost + ":" + host.port;
              });
              return hostString;
            },
            defaultContent: "Unknown"
          },
          {
            title: "Available At",
            mRender: function (data, type, ai) {
              if (!ai.containerId)
                return "NOWHERE";

              var hn = "";
              // Add the host IP+app port as a hostname because it will work, too.
              // Currently each app instance will only be on one host.
              var dockerHosts = ai.dockerHosts || [];
              Hosts.find({_id: {$in: dockerHosts}}).forEach(function (host) {
                var hostString = host.publicHost + ":" + ai.port;
                hn += '<div><a href="http://' + hostString + '" target="_blank">' + hostString + '</a></div>';
              });
              // Add any extra defined hostnames.
              _.each(ai.hostnames, function (hostname) {
                hn += '<div><a href="http://' + hostname + '" target="_blank">' + hostname + '</a></div>';
              });
              return hn;
            },
            defaultContent: "Unknown"
          },
          {
            title: "Image",
            data: "image",
            defaultContent: "Unknown"
          },
          {
            title: "Status",
            data: "status",
            width: "45px",
            mRender: function (data, type, ai) {
              if (!ai.containerId)
                return "DEACTIVATED";

              return ai.status;
            },
            defaultContent: "Unknown"
          },
          {
            orderable: false,
            width: "30px",
            mRender: function (data, type, ai) {
              return '<a class="btn btn-sm btn-default info" href="/app/' + ai._id + '">Details</a>';
            },
            defaultContent: "Unknown"
          },
          {
            data: "port",
            sType: "numeric",
            bVisible: false, // column is hidden but included to be searchable
            defaultContent: "Unknown"
          },
          {
            data: "containerId",
            bVisible: false, // column is hidden but included to be searchable
            defaultContent: "Unknown"
          },
          {
            mRender: function (data, type, ai) {
              return ai.container && ai.container.pid || ""; // XXX does not seeem to be searchable, not sure why
            },
            bVisible: false, // column is hidden but included to be searchable
            defaultContent: "Unknown"
          },
          {
            data: "env",
            mRender: function (data, type, ai) {
              var lines = _.map(ai.env, function (val, name) {
                return name + "=" + val;
              });
              return lines.join("<br>");
            },
            bVisible: false, // column is hidden but included to be searchable
            defaultContent: "Unknown"
          },
          {
            data: "actualEnv",
            mRender: function (data, type, ai) {
              return (ai.actualEnv || []).join("<br>");
            },
            bVisible: false, // column is hidden but included to be searchable
            defaultContent: "Unknown"
          }
        ],
        options: {
          order: [0, "desc"], // sort by createdAt descending
          initComplete: function () {
            $("#appInstancesTable input[type=search]").attr("placeholder", "Search");

            // Because we're using bootstrap, I guess we're supposed to add the
            // tableTools after init.
            var tableTools = new $.fn.dataTable.TableTools(this, {
              sRowSelect: "multi",
              aButtons: [
                {
                    "sExtends": "text",
                    "sButtonText": "New",
                    "sButtonClass": "btn btn-default btn-sm newAppInstance"
                },
                "select_all",
                "select_none",
                {
                    "sExtends": "select",
                    "sButtonText": "Stop",
                    "sButtonClass": "btn btn-default btn-sm stop"
                },
                {
                    "sExtends": "select",
                    "sButtonText": "Start",
                    "sButtonClass": "btn btn-default btn-sm start"
                },
                {
                    "sExtends": "select",
                    "sButtonText": "Restart",
                    "sButtonClass": "btn btn-default btn-sm restart"
                },
                {
                    "sExtends": "select",
                    "sButtonText": "Kill",
                    "sButtonClass": "btn btn-default btn-sm kill"
                },
                {
                    "sExtends": "select",
                    "sButtonText": "Delete",
                    "sButtonClass": "btn btn-default btn-sm remove"
                },
                {
                    "sExtends": "select",
                    "sButtonText": "Rebuild",
                    "sButtonClass": "btn btn-default btn-sm rebuild"
                },
                {
                    "sExtends": "select",
                    "sButtonText": "Deactivate",
                    "sButtonClass": "btn btn-default btn-sm deactivate"
                },
                {
                    "sExtends": "select",
                    "sButtonText": "Activate",
                    "sButtonClass": "btn btn-default btn-sm activate"
                },
                "csv",
                "xls"
              ],
              sSwfPath: "copy_csv_xls.swf"
            });
            $(tableTools.fnContainer()).insertBefore('div.dataTables_wrapper');
          }
        }
      };
    }
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

if (Meteor.isClient) {
  UI.registerHelper("currentPageIs", function (name) {
    var current = Router.current();
    return current && current.route.name === name;
  });
}