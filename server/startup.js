// Settings fixture data
Meteor.startup(function () {
  if (Settings.find().count() === 0) {
    Settings.direct.insert({
      activeHeal: false
    });
  }

//
//  Do 10 second polling of host and app instance details - this is the "active heal" polling
//
  Meteor.setInterval(function () {
    if (Settings.findOne().activeHeal) {
      HostActions.updateAll();
      ContainerActions.updateInfoForAll();
    }
  }, 30000);
});


 Meteor.startup(function () {
    AccountsEntry.config({
      signupCode: 'launchdock'        // only restricts username+password users, not OAuth
    });
  });
