Utility = {
  ensureDir: function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, 0777);
    }
  }
};