
// ******************************************
// Setup Gauges
// see:  http://bernii.github.io/gauge.js/
// ******************************************
 gaugeData = [];
 gauge = [];
 reactiveGauge = function(id, currVal, maxValue) {
  // console.log("reactiveGauge",id, currVal, maxValue)

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
      colorStop: '#8FC0DA',    // just experiment with them
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

Template.dashboard.helpers({
  totalInstances: function () {
    if (this.tag) {
      return this.tag;
    } else {
      return this._id;
    }
  },
  totalInstances: function () {
    return AppInstances.find().count();
  },
  runningInstances: function () {
    return AppInstances.find({'status':'running','dockerHosts':this._id}).count();
  },
  pausedInstances: function () {
    return AppInstances.find({'status':'stopped','dockerHosts':this._id}).count();
  },
  runningHosts: function () {
    return Hosts.find({'active':true});
  },
  totalHosts: function () {
    return Hosts.find().count();
  },
  hostGuage: function () {
    gaugeData.push({'id':this._id,'currVal':this.details.Containers,'maxValue':this.max});
    Session.set("gaugeData",{'id':this._id,'currVal':this.details.Containers});
  }
});

Template.dashboard.rendered = function () {
    _.each(gaugeData, function (gauge) {
      reactiveGauge(gauge.id,gauge.currVal,gauge.maxValue);
    });
  Deps.autorun(function(){
      data = Session.get('gaugeData')
      gauge[data.id].set(data.currVal)
  });
};
