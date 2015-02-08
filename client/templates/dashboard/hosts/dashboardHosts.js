
// ******************************************
// Setup Gauges
// see:  http://bernii.github.io/gauge.js/
// ******************************************
 gaugeData = [];
 gauge = [];
 reactiveGauge = function(id, currVal, maxValue) {
  // console.log("reactiveGauge",id, currVal, maxValue)
  var percent = (currVal / maxValue) * 100;

  if (percent < 30) { var colorStop = "#8FC0DA" } else
  if (percent < 60) { var colorStop = "#f0ad4e" } else var colorStop = "#d9534f";

  if (id) {
    var opts = {
      lines: 12, // The number of lines to draw
      angle: 0.15, // The length of each line
      lineWidth: 0.44, // The line thickness
      pointer: {
        length: 0.7, // The radius of the inner circle
        strokeWidth: 0.035 // The rotation offsetiv>
      },
      colorStart: '#6FADCF',   // Colors
      colorStop: colorStop,    // just experiment with them
      strokeColor: '#E0E0E0'   // to see which ones work best for you
    };
    var target = document.getElementById(id); // your canvas element
    gauge[id] = new Gauge(target).setOptions(opts); // create sexy gauge!
    // gauge.value = value; // set actual value
    gauge[id].maxValue = maxValue; // set max gauge value
    gauge[id].animationSpeed = 32;
    gauge[id].set(currVal);
  }
}

Template.dashboardHosts.helpers({
  tag: function () {
    if (this.tag) {
      return this.tag;
    } else {
      return this._id;
    }
  },
  totalInstances: function () {
    return AppInstancesCount.find().count();
  },
  runningInstances: function () {
    return AppInstances.find({'status':'running','dockerHosts':this._id}).count() || 0;
  },
  pausedInstances: function () {
    return AppInstances.find({'status':'stopped','dockerHosts':this._id}).count() || 0;
  },
  runningHosts: function () {
    return Hosts.find({'active':true});
  },
  userHosts: function () {
    return Hosts.find({'userId':Meteor.userId()}).count() || 0;
  },
  totalHosts: function () {
    return Hosts.find().count();
  },
  hostGuage: function () {
    if (this.details) {
      var containers = this.details.Containers || 0;
    } else {
      var containers = 0
    }
    gaugeData.push({'id':this._id,'currVal':containers,'maxValue':this.max});
    Session.set("gaugeData",{'id':this._id,'currVal':containers,'maxValue':this.max});
  }
});

Template.dashboardHosts.rendered = function () {
    _.each(gaugeData, function (gauge) {
      reactiveGauge(gauge.id,gauge.currVal,gauge.maxValue);
    });
  Tracker.autorun(function(){
      data = Session.get('gaugeData')
      if (data) {
        if (!gauge[data.id]) reactiveGauge(data.id,data.currVal,data.maxValue);
        if (data.id) gauge[data.id].set(data.currVal);
      }
  });
};
