Meteor.startup(function () {
	if (Meteor.users.find().count() === 0) {
		// If we have no users, create one initial default user
		var userId = Accounts.createUser({
			username: 'admin',
			password: 'admin',
			profile: {
				name: 'Default Admin'
			},
			roles:['admin']
		});
		// Add to admin role
		Roles.addUsersToRoles(userId, 'admin');
	}
});