AutoForm.addHooks(null, {
  onError: function (type, error, template) {
    alertify.error(error.message);
  },
  onSuccess: function (type, result, template) {
    alertify.success(type + " successfully:");
  }
});