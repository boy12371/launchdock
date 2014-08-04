Template.settings.helpers({
  settingsDoc: function () {
    return Settings.findOne();
  }
});

AutoForm.hooks({
  settingsAdminForm: {
    onSuccess: function(operation, result, template) {
      alertify.success("System settings saved.", "success");
    },
    onError: function(operation, error, template) {
      alertify.error("System settings update failed. " + error, "danger");
    }
  }
});
