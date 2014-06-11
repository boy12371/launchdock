Utility = {
  ensureDir: function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, 0777);
    }
  },
  checkLoggedIn: function checkLoggedIn(userId) {
    if (!userId)
      throw new Meteor.Error(401, "Access Denied");
  }
};