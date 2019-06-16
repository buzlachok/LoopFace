import * as messaging from "messaging";
import { settingsStorage } from "settings";
import { me } from "companion";

//
const second = 1000;
const minute = 60 * second;

//Periodic wake
me.wakeInterval = 5 * minute;

me.onwakeinterval = evt => {
  console.log("Companion was already awake - onwakeinterval");
  queryNightscout();
};

if (me.launchReasons.wokenUp) {
  // The companion started due to a periodic timer
  console.log("Started due to wake interval!");
  queryNightscout();
}


//Initialize
var lastSendDate = new Date(2018, 1, 1, 1, 1, 1, 1);

// Apply Settings NEEDS WORK !!!!!!!!
const API_ENDPOINT = "/api/v1/devicestatus.json";
var nightscoutBase = null;
var nightscoutUrl = nightscoutBase + API_ENDPOINT;
var hashedApiSecret = null;

try {
  nightscoutBase = JSON.parse(settingsStorage.getItem('nightscoutSiteName')).name;
  nightscoutUrl = nightscoutBase + API_ENDPOINT;
} catch(err){
  console.log("no nightscout url set");
}

try {
  hashedApiSecret = JSON.parse(settingsStorage.getItem('hashedApiSecret')).name;
} catch (err){
  console.log("no hashed api secret set");
}


settingsStorage.onchange = (evt) => {
  if(evt.key == "nightscoutSiteName"){
    nightscoutBase = JSON.parse(settingsStorage.getItem('nightscoutSiteName')).name;
    nightscoutUrl = nightscoutBase + API_ENDPOINT;
    queryNightscout();
  } else {
    if (evt.key == "hashedApiSecret"){
      hashedApiSecret = JSON.parse(settingsStorage.getItem('hashedApiSecret')).name;
    } else {
      let key = evt.key;
      let value = JSON.parse(evt.newValue);
      sendDataToDevice({
        "type": "settings",
        "key": key,
        "value": value
      });
    }
  }
};

function sendDataToDevice(data){
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    messaging.peerSocket.send(data);
  } else {
    console.log("Error: Connection is not open");
  }
}



// Communicate with clockface

messaging.peerSocket.onopen = () => {
  //nightscoutUrl = (JSON.parse(settingsStorage.getItem('nightscoutSiteName')).name) + API_ENDPOINT;
  queryNightscout();
};

messaging.peerSocket.onerror = (err) => {
  console.log(`Connection error: ${err.code} - ${err.message}`);
};

messaging.peerSocket.onmessage = (evt) => {
  console.log(JSON.stringify(evt.data));
  if(evt.data["getValues"] == true){
    queryNightscout();
  }
  if(evt.data["getValues"] != true){
    if(evt.data["sendCarbs"] == true){
      let treatmentsUrl = nightscoutBase + "/api/v1/treatments.json";
      let requestDate = Date.parse(evt.data["date"].toString());
      let millisSinceLast = requestDate - lastSendDate;
      console.log(millisSinceLast / second);
      if(millisSinceLast > 5*second){
        sendCarbsToNightscout(treatmentsUrl, evt.data["carbData"])
            .then(data => sendResponseToDevice(data))// JSON-string from `response.json()` call;
            .catch(error => sendResponseToDevice(error));
        lastSendDate = new Date();
      }
    } else {
      let tempTargetUrl = nightscoutBase + "/api/v1/treatments.json";
      sendTempTargetToNightscout(tempTargetUrl, evt.data["tempTarget"], evt.data["tempTargetMinutes"])
          .then(data => sendTempResponseToDevice(data))// JSON-string from `response.json()` call;
          .catch(error => sendTempResponseToDevice(error));
    }
  }
};



// Fetch the devicestatus data from nightscout
function queryNightscout() {
  console.log("started queryNightscout: " + nightscoutUrl);
  if (nightscoutUrl != null){
    fetch(nightscoutUrl)
        .then(function (response) {
          response.json()
              .then(function(data) {
                var nightscoutData = parseNsData(data);
                sendDataToDevice(nightscoutData);
              });
        })
        .catch(function (err) {
          console.log("Error fetching data: " + err);
        });
  } else {
    console.log("nightscoutUrl is null");
  }
}


function parseNsData(data){
  let nightscoutData;
  let iobRound;
  let cobRound;
  let dateOfValue;
  let newlyAddedInsulin;
  nightscoutData = null;
  let i = 0;
  while(nightscoutData == null && i <= 10) {
    try {
      //minutesSinceValue = calculateMinutesAgo(data[0]["openaps"]["suggested"]["timestamp"]);
      newlyAddedInsulin = parseFloat(data[i]["openaps"]["suggested"]["units"]);
      iobRound = Math.round(data[i]["openaps"]["suggested"]["IOB"] * 10) / 10.0;
      cobRound = Math.round(data[i]["openaps"]["suggested"]["COB"] * 10) / 10.0;
      dateOfValue = data[i]["openaps"]["suggested"]["timestamp"];
      nightscoutData = {
        "type": "nightscout",
        "bg": data[i]["openaps"]["suggested"]["bg"],
        "iob": iobRound + newlyAddedInsulin,
        "cob": cobRound,
        "tick": data[i]["openaps"]["suggested"]["tick"],
        "dateOfValue": dateOfValue
      };
    } catch (err) {
      nightscoutData = null;
      console.log("unable to download ns data");
    }
    if (i == 10){
      nightscoutData = {
        "type": "error"
      }
    }
    i = i + 1;
  }
  return nightscoutData;

}


// SEND CARBS TO NIGHTSCOUT

function sendCarbsToNightscout(url, data) {
  let httpData;
  httpData = {
    "enteredBy": "Fitbit",
    "reason": "Carb Correction",
    "carbs": data,
    "secret": hashedApiSecret
  };

  // Default options are marked with *
  return fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, cors, *same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    //referrer: 'no-referrer', // no-referrer, *client
    body: JSON.stringify(httpData), // body data type must match "Content-Type" header
  })
      .then(response => response.json()); // parses JSON response into native Javascript objects

}

// SICHERSTELLEN DASS WIRKLICH HOCHGELADEN WURDE
function sendResponseToDevice(response) {
  let isUploaded = false;

  console.log(JSON.stringify(response));

  try {
    if (response[0]["enteredBy"] == "Fitbit"){
      isUploaded = true;
    }
  } catch (err){
    console.log(err);
  }

  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    messaging.peerSocket.send({
      type: "nsResponse",
      isOk: isUploaded,
    });
  }
}


// SEND TEMP TARGET TO NIGHTSCOUT

function sendTempTargetToNightscout (url, target, minutes) {
  console.log(url);
  console.log(target);
  console.log(minutes);

  // anpassen für Temp Target
  let httpData;
  httpData = {
    "enteredBy": "Fitbit",
    "eventType": "Temporary Target",
    "reason": "",
    "targetTop": target,
    "targetBottom": target,
    "duration": minutes,
    "notes": "set by LoopFace",
    "secret": hashedApiSecret
  };

  return fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, cors, *same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    //referrer: 'no-referrer', // no-referrer, *client
    body: JSON.stringify(httpData), // body data type must match "Content-Type" header
  })
      .then(response => response.json()); // parses JSON response into native Javascript objects
}

function sendTempResponseToDevice(response){
  let isUploaded = false;

  console.log(JSON.stringify(response));

  try {
    if (response[0]["enteredBy"] == "Fitbit"){
      isUploaded = true;
    }
  } catch (err){
    console.log(err);
  }

  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    messaging.peerSocket.send({
      type: "nsTempResponse",
      isOk: isUploaded,
    });
  }
}