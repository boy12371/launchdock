settings = Settings.findOne();
if (settings) {
  if (settings.kadira && !Meteor.settings.kadira) {
    Kadira.connect(settings.kadira.appId, settings.kadira.appSecret)
  }

  if (settings.mailURL) {
      Meteor.settings.MAIL_URL = settings.mailUrl;
  }
}
