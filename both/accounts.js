Accounts.config({
	forbidClientAccountCreation: true,
	sendVerificationEmail: false
});

if (Meteor.isClient) {
	Accounts.ui.config({
		passwordSignupFields: 'USERNAME_AND_OPTIONAL_EMAIL'
	});
}