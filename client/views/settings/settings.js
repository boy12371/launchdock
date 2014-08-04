Template.settings.helpers({
  settingsDoc: function () {
    return Settings.findOne();
  }
});

AutoForm.hooks({
  settingsAdminForm: {
    onSuccess: function(operation, result, template) {
      console.log("System settings saved.", "success");
    },
    onError: function(operation, error, template) {
      console.log("System settings update failed. " + error, "danger");
    }
  }
});
