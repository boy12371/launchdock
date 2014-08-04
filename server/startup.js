// Do 10 second polling of host and app instance details
Meteor.startup(function () {
  if (Settings.find().count() === 0) {
    Settings.direct.insert({
      activeHeal: false
    });
  }

  Meteor.setInterval(function () {
    if (Settings.findOne().activeHeal) {
      Meteor._debug("heartbeat");
      HostActions.updateAll();
      ContainerActions.updateInfoForAll();
    }
  }, 30000);
});
