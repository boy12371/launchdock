if (Settings.findOne().kadira) {
  kadira = Settings.findOne().kadira;
  Kadira.connect(kadira.appId, kadira.appSecret)
}