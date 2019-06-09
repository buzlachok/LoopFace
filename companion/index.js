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

nightscoutUrl = (JSON.parse(settingsStorage.getItem('nightscoutSiteName')).name) + API_ENDPOINT;
hashedApiSecret = (JSON.parse(settingsStorage).getItem('hashedApiSecret')).name;

settingsStorage.onchange = (evt) => {
  if(evt.key == "nightscoutSiteName"){
    nightscoutUrl = JSON.parse(settingsStorage.getItem('nightscoutSiteName')).name + API_ENDPOINT;
    queryNightscout();
  } else {
    if (evt.key == "hashedApiSecret"){

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
