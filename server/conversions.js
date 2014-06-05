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
});