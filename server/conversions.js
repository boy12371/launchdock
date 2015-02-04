Meteor.startup(function () {
	// We no longer store `http://` prefix for hosts. We add it when necessary.
	Hosts.find().forEach(function (host) {
		var mod = {$set: {}}, needsUpdating = false;

		_.each(["privateHost", "publicHost"], function (prop) {
			if (host[prop] && host[prop].indexOf("http://") === 0) {
				mod.$set[prop] = host[prop].replace("http://", "");
				needsUpdating = true;
			}
		});

		needsUpdating && Hosts.update(host._id, mod);
	});

	// We no longer store "host" or "docker" properties in app instances,
	// and we need the "dockerHosts" array now. Also, we need to auto-create
	// the necessary hosts.
	AppInstances.find({containerId:{$ne:null}, dockerHosts:null}).forEach(function (ai) {
		var mod = {$set: {}, $unset: {host: "", docker: ""}};

		var host = Hosts.findOne({privateHost: ai.host});
		var hostId;
		if (!host) {
			hostId = Hosts.insert({privateHost: ai.host, publicHost: ai.host, protocol: ai.protocol, port: 2375, max: 200, active: true});
		} else {
			hostId = host._id;
		}

		mod.$set.dockerHosts = [hostId];
		// We don't validate because it will strip out keys not in the schema,
		// even from `$unset`
		AppInstances.update(ai._id, mod, {validate: false});
		//We also need to update ROOT_URL to use hostnames now
		if (ai.env.ROOT_URL = "http://localhost") {
			var ROOT_URL = "https://"+ai.hostnames[0];
			AppInstances.update(ai._id, {$set:{"env.ROOT_URL": ROOT_URL}});
		}
	});
});
