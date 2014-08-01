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
  appInstancesTableQuery: function () {
    var query = {};
    var searchFor = Session.get("appInstanceSearchQuery") || "";
    searchFor = searchFor.split(" ");
    _.each(searchFor, function (term) {
      if (term.length === 0)
        return;

      query.$or = query.$or || [];

      _.each(["image", "containerId", "status", "actualEnv", "hostnames"], function (key) {
        var q = {};
        q[key] = {$regex: term, $options: "i"};
        query.$or.push(q);
      });

      var numTerm = parseInt(term, 10);
      if (!isNaN(numTerm)) {
        _.each(["port", "container.pid"], function (key) {
          var q = {};
          q[key] = numTerm;
          query.$or.push(q);
        });
      }

    });
    return query;
  },
  searchTerms: function () {
    return Session.get("appInstanceSearchQuery");
  }
});

