// Set up variables used throughout
// Set server dir for use everywhere
if (Meteor.isServer) {
  serverDir = __meteor_bootstrap__ && __meteor_bootstrap__.serverDir;
  if (!serverDir) {
      throw new Error("Unable to determine the server directory");
  }

  // DOCKER SSL DEFAULTS
  // TODO throw a warning if the cert read is the same as the github repo test cert.
  // Boot2docker generates new certs on install, so you'll need to copy your own from DOCKER_CERT_PATH
  if (!Meteor.settings.dockerSSL) {
    Meteor.settings.dockerSSL = {
      "path": serverDir  + "/assets/app/docker",
      "ca": "ca.pem",
      "cert": "cert.pem",
      "key": "key.pem"
    };
  }
}

if (Meteor.settings) {
  // HIPACHE DEFAULTS
  if (!Meteor.settings.hipache) Meteor.settings.hipache = {};
  // REDIS DEFAULTS
  if (!Meteor.settings.redis) Meteor.settings.redis = {};
  // DOCKER DEFAULTS
  if (!Meteor.settings.docker) Meteor.settings.docker = {};

  // SETTINGS COLLECTION
  settings = Settings.findOne();
  if (settings) {
    // KADIRA DEFAULTS
    if (settings.kadira && !Meteor.settings.kadira) {
      Kadira.connect(settings.kadira.appId, settings.kadira.appSecret);
    }
    // MAIL URL
    if (settings.mailURL) {
        Meteor.settings.MAIL_URL = settings.mailUrl;
    }
  }
}
