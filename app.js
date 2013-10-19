var five = require("johnny-five"),
    board, fsr1, fsr2, mag,
	colors = require("colors"),
	Spacebrew = require('./sb-1.3.0').Spacebrew,
	sb,
	config = require("./machine");

//log deltas to the console for debugging thresholds
var debug = true;
var debug_sensor = 1;

//array of output buffers
var buffers = [];
//array of sensors
var fsrs = [];
//array of thresholds values
var thresholds = [];
//length of buffer array
var MAX_BUFFER_LENGTH = 15;
//boolean for on/off buffer
var occupySeat = false;
var occupyBack = false;
// shift register for deboucing
var shift_registers = [];
var shift_register_max = 20;




// setup spacebrew
sb = new Spacebrew.Client( config.server, config.name, config.description );  // create spacebrew client object


// create the spacebrew subscription channels
//sb.addPublish("config", "string", "");	// publish config for handshake
//sb.addSubscribe("config", "boolean");	// subscription for config handshake


sb.addPublish("seat", "boolean", "false");		// publish the serialized binary image data
sb.addPublish("back", "boolean", "false");



sb.onOpen = onOpen;

// connect to spacbrew
sb.connect();  


/**
 * Function that is called when Spacebrew connection is established
 */
function onOpen() {
	console.log( "Connected through Spacebrew as: " + sb.name() + "." );


	(new five.Board()).on("ready", function() {

	  //FSR 00
	  fsrs[0] = new five.Sensor({
	    pin: "A0",
	    freq: 100
	  });

	  buffers[0] = [];
	  thresholds[0] = 80;
	  shift_registers[0] = [];

	  fsrs[0].scale([ 0, 100 ]).on("data",function(){
	    //console.log("seat_left: " + this.value);
	    //var oc = occupied( 0, this.value );
	    occupySeat = debounce(0 ,occupied( 0, this.value ));
	    if (occupySeat==true){
	    	sb.send("seat", "boolean", occupySeat);
	    } else {
	    	sb.send("seat", "boolean", false);
	    }
	  });


	  //FSR 01
	  fsrs[1] = new five.Sensor({
	    pin: "A1",
	    freq: 100
	  });

	  buffers[1] = [];
	  thresholds[1] = 90;
	  shift_registers[1] = [];
	  
	  fsrs[1].scale([ 0, 100 ]).on("data",function(){
	    //console.log("seat_left: " + this.value);
	    //var oc = occupied( 1, this.value );
	    if (occupySeat == true){
	    	occupyBack = debounce(1, occupied( 1, this.value ));
	    	sb.send("back", "boolean", occupyBack)
	    } else {
	    	sb.send("back", "boolean", false);
	    }
	  });

	  
	  /*
	  //MAGNETOMETER
	  mag = new five.Magnetometer();

	  //on heading change
	  mag.on("headingchange", function() {
	    console.log( "heading", Math.floor(this.heading) );
	    console.log( "bearing", this.bearing );
	  });

	  //raw data logging
	  mag.on("data", function( err, timestamp ) {
	     console.log( "data", this.raw );
	     //process.exit();
	  });

	  */
	});
}





















/*

PROJECT: Object Oriented Office (OOO)
SCRIPT: ooo_chair.js
VERSION: 0.02
FUNCTION: Operating code, via the Johhny-Five framework,
  for collecting data from embedded sensors in an office
  chair, and determining whether the chair is occupied and
  how it is oriented.
SENSORS: FSR (force-sensitive resistor), Magnetometer (compass)
HARDWARE: Arduino Uno R3

ISSUES:
  (0) 2+ FSRs Produce Reading Drift -> Buffered Reading (see 1)
  (1) Determine Threshold Values for each FSR (tweak for setting)
  (2) Working Magnetometer

FSR LOCATIONS:
  (0) Chair Seat
  (1) Chair Back

WIRING DIAGRAM:
  https://raw.github.com/site2site/object-oriented-office/master/docs/images/ooo_office_v0-2.png

*/


//function for grabbing minimum value from buffer array
function getMin( buf ){
  var rtn = buf[0];
  //check if buffer value is lower than current min / ifso log as min
  for(var i = 1; i < buf.length; i++){
    rtn = Math.min( rtn, buf[i] );
  }
  return rtn;
}

//function for grabbing maximum value from buffer array
function getMax( buf ){
  var rtn = buf[0];
  //check if buffer value is higher than current max / ifso log as max
  for(var i = 1; i < buf.length; i++){
    rtn = Math.max( rtn, buf[i] );
  }
  return rtn;
}

//function for determining occupancy through thresholds
function occupied( fsr_index, value ){
  //if buffer is full, push out last value (first in first out)
  if(buffers[ fsr_index ].length > MAX_BUFFER_LENGTH){
    buffers[ fsr_index ].shift();
  }
  //add current value to buffer
  buffers[ fsr_index ].push( value );

  //grab minimum value
  var min;
  if(buffers[ fsr_index ].length > 0){
    min = getMin( buffers[ fsr_index ] );
  }else{
    min = value;
  }

  //grab maximum value
  var max;
  if(buffers[ fsr_index ].length > 0){
    max = getMax( buffers[ fsr_index ] );
  }else{
    max = value;
  }

  //determine value range
  var delta = max - min;
  
  if (debug){
    if (fsr_index == debug_sensor){
          console.log(fsr_index+ ': '+ delta);
    }
  }

  //check if value range is within occupancy threshold
  if(delta > thresholds[ fsr_index ]){
    return true;
  }else{
    return false;
  }
}

//de-bounce function for occupancy
function debounce( fsr_index, new_value ){
  if(shift_registers[ fsr_index ].length > shift_register_max){
    shift_registers[ fsr_index ].shift();
  }

  shift_registers[ fsr_index ].push(new_value);

  var total = 0;
  shift_registers[ fsr_index ].forEach(function(val){
    if(val == true){
      total++;
    }
  });

  if( (total/2) >= (shift_register_max/2) ){
    return true;
  }else{
    return false;
  } 
}

