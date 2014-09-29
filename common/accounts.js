// Accounts.config({
// 	forbidClientAccountCreation: true,
// 	sendVerificationEmail: false
// });
Meteor.startup(function () {
  AccountsEntry.config({
    logo: 'images/signin.png',                  // if set displays logo above sign-in options
    // privacyUrl: '/privacy-policy',     // if set adds link to privacy policy and 'you agree to ...' on sign-up page
    // termsUrl: '/terms-of-use',         // if set adds link to terms  'you agree to ...' on sign-up page
    homeRoute: '/',                    // mandatory - path to redirect to after sign-out
    dashboardRoute: '/dashboard',      // mandatory - path to redirect to after successful sign-in
    profileRoute: '/settings',
    passwordSignupFields: 'USERNAME_AND_OPTIONAL_EMAIL',
    showSignupCode: true,
    showOtherLoginServices: true     // Set to false to hide oauth login buttons on the signin/signup pages. Useful if you are using something like accounts-meld or want to oauth for api access
  });
});
