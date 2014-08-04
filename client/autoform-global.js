function capitaliseFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

AutoForm.addHooks(null, {
  onError: function (type, error, template) {
    alertify.error(capitaliseFirstLetter(error.message));
  },
  onSuccess: function (type, result, template) {
    alertify.success(capitaliseFirstLetter(type) + " completed.");
  }
});