import * as messaging from "messaging";
import { settingsStorage } from "settings";
import { me } from "companion";

// update every 5 minutes
//const minute = 1000 * 60;
//var intervalID = setInterval(queryNightscout(), 5*minute);




// Apply Settings NEEDS WORK !!!!!!!!
const API_ENDPOINT = "/api/v1/devicestatus.json";
var backgroundColor;
var textColor;
var nightscoutUrl = null;
var hashedApiSecret = null;

try {
  nightscoutUrl = (JSON.parse(settingsStorage.getItem('nightscoutSiteName')).name) + API_ENDPOINT;
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
    nightscoutUrl = JSON.parse(settingsStorage.getItem('nightscoutSiteName')).name + API_ENDPOINT;
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
}

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
}

messaging.peerSocket.onerror = (err) => {
  console.log(`Connection error: ${err.code} - ${err.message}`);
}

messaging.peerSocket.onmessage = (evt) => {
  console.log(JSON.stringify(evt.data));
  if(evt.data["getValues"] == true){
    queryNightscout();
  }
}



// Fetch the devicestatus data from nightscout
function queryNightscout() {
  console.log("started queryNightscout: " + nightscoutUrl);
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
}


function parseNsData(data){
  let minutesSinceValue;
  let nightscoutData;
  let iobRound;
  let cobRound;
  let dateOfValue;
  let minutesAgoInt;
  let minutesAgoStr;
  nightscoutData = null;
  let i = 0;
  while(nightscoutData == null){
    try {
      //minutesSinceValue = calculateMinutesAgo(data[0]["openaps"]["suggested"]["timestamp"]);
      iobRound = Math.round(data[i]["openaps"]["suggested"]["IOB"] * 10) / 10.0;
      cobRound = Math.round(data[i]["openaps"]["suggested"]["COB"] * 10) / 10.0;
      dateOfValue = data[i]["openaps"]["suggested"]["timestamp"];
      nightscoutData = {
        "type": "nightscout",
        "bg": data[i]["openaps"]["suggested"]["bg"],
        "iob": iobRound,
        "cob": cobRound,
        "tick": data[i]["openaps"]["suggested"]["tick"],
        "dateOfValue": dateOfValue
      };
    } catch(err){
      nightscoutData = null;
    }
    i = i+1;
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
    "secret": apiHash
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
      isOk: isUploaded
    });
  }
}
