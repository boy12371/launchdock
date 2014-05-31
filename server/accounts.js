Meteor.startup(function () {
	if (Meteor.users.find().count() === 0) {
		// If we have no users, create one initial default user
		Accounts.createUser({
			username: 'admin',
			password: 'admin',
			profile: {
				name: 'Default Admin'
			}
		});
	}
});