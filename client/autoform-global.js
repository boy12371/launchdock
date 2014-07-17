AutoForm.addHooks(null, {
  onError: function (type, error, template) {
    console.log(error);
    alert("There was an error!");
  },
  onSuccess: function (type, result, template) {
    console.log(type + " was successful with result:", result);
  }
});