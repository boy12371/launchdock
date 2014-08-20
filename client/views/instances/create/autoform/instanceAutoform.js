//
//  docker hub autocomplete input template
//
Template["afInput_createAppInstance"].hubAutocomplete = function () {
  return Session.get('hubSearch') || [];
};

Template["afInput_createAppInstance"].rendered = function() {
  Meteor.typeahead('.typeahead');
}
