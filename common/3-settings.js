// if (!process.env.METEOR_SETTINGS) {
//   console.log("=> No METEOR_SETTINGS passed in, using locally defined settings.");
//   Meteor.settings =
//     {
//         "public": {
//             "ga": {
//                 "account": "UA-44704216-5"
//             }
//         },
//         "MailChimpOptions": {
//             "apiKey": "299fec905e30f280b0ea4fb0b1e59be5-us3",
//             "listId": "ee1a7dc8a4"
//         },
//         "rockerSettings": {
//             "mongoUser": "admin",
//             "mongoPassword": "23PPVbUV",
//             "launchMongoDB": "SG-ReactionDBCluster-2823.servers.mongodirector.com:27017,SG-ReactionDBCluster-2824.servers.mongodirector.com:27017/",
//             "replicaSet": "RS-ReactionDBCluster-0",
//             "ddpUrl": "http://54.201.164.44:8080",
//             "ddpPassword": "0ng0w0rks"
//         }
//     }

//   // Push a subset of settings to the client.
//   if (Meteor.settings && Meteor.settings.public) {
//     __meteor_runtime_config__.PUBLIC_SETTINGS = Meteor.settings.public;
//   }
// }

settings = Settings.findOne();
if (settings) {
  if (settings.kadira) {
    Kadira.connect(settings.kadira.appId, settings.kadira.appSecret)
  }

  if (settings.mailURL) {
      Meteor.settings.MAIL_URL = settings.mailUrl;
  }
}