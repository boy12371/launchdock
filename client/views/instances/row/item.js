Template.instanceRowItem.events({
  'click': function (event,target) {
    $(event.target).parent().toggleClass('selected');
  }
});