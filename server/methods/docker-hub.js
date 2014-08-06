dockerHubURL = "https://index.docker.io/v1";
dockerRegistryURL = "https://registry.hub.docker.com";
/*
 * Methods related to docker hub: prefix with "hub/"
 * https://docs.docker.com/reference/api/docker-io_api/
 */
Meteor.methods({
  'hub/autocomplete':  function (query) {
    this.unblock();
    var result = HTTP.get(dockerRegistryURL+"/autocomplete?q="+query+"&pretty=true&size=20");
    return result.data;
  },
  'hub/search':  function (query) {
    this.unblock();
    var result = HTTP.get(dockerHubURL+"/search?q="+query);
    return result.data.results;
  },
  'hub/getImages':  function (namespace,repository) {
    this.unblock();
    var result = HTTP.get(dockerHubURL+"/repositories/"+namespace+"/"+repository+"/images");
    return result;
  },
  'hub/login':  function (username,password) {
    this.unblock();
    var result = HTTP.get(dockerHubURL+"/users/"+username+"/");
    // Store token if successful
    return result;
  },
  'hub/getTags':  function (namespace,repository) {
    this.unblock();
    try {
      var result = HTTP.get(dockerHubURL+"/repositories/"+namespace+"/"+repository+"/tags");
    } catch (error) {
      throw new Meteor.Error(404, 'Internal server error', "Invalid getTags: " + (error && error.message ? error.message : 'Unknown'));
    }
    return result.data;
  },
});