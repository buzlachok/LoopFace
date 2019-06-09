import clock from "clock";
import document from "document";
import { preferences } from "user-settings";
import * as util from "../common/utils";
import * as messaging from "messaging";
import { battery } from "power";
import { charger } from "power";

// NEEDS WORK NEEDS WORK
// second page
const cobIcon = document.getElementById("cobIcon");
const carbsViewElements = document.getElementsByClassName("carbsView");
const carbsViewBack = document.getElementById("backButton");

cobIcon.onclick = function(evt){
  for(let i=0;i<carbsViewElements.length;i++){
    carbsViewElements[i].style.display = "inline";
  }
  //carbsBackground.style.visibility = "visible";
};


carbsViewBack.onactivate = function(evt) {
  for(let i=0;i<carbsViewElements.length;i++){
    carbsViewElements[i].style.display = "none";
  }
};

//Initializing
//const background = document.getElementsByClassName("background");
//const text = document.getElementsByClassName("text");
var lastValueDate;

messaging.peerSocket.onopen = () => {
  updateBatteryDisplay();
};

messaging.peerSocket.onerror = (err) => {
  console.log(`Connection error: ${err.code} - ${err.message}`);
};


 
// Nightscout Data Display

// Get text elements from clockface
const bgDisplay = document.getElementById("bg");
const tickDisplay = document.getElementById("tick");
const iobDisplay = document.getElementById("iob");
const cobDisplay = document.getElementById("cob");
const minutesAgoDisplay = document.getElementById("minutesAgo");


// update clockface when companion sends new values
messaging.peerSocket.onmessage = (evt) => {
  console.log(JSON.stringify(evt.data));
  if(evt.data["type"] == "nightscout"){
    bgDisplay.text = evt.data["bg"];
    tickDisplay.text = evt.data["tick"];
    iobDisplay.text = evt.data["iob"];
    cobDisplay.text = evt.data["cob"];
    lastValueDate = evt.data["dateOfValue"];
    minutesAgoDisplay.text = calculateMinutesAgo(lastValueDate) + "m";
  }

  if(evt.data["type"] == "nsResponse"){
    showIfCarbsUploaded(evt.data);
  }

  if(evt.data["type"] == "settings"){
    console.log(JSON.stringify(evt.data));
    if(evt.data["key"] == "colorBackground"){
      let bgColor = document.getElementById("bgColor");
      bgColor.style.fill = evt.data["value"];
    }
    if(evt.data["key"] == "colorText"){
      let text = document.getElementsByClassName("text");
      text.forEach(function(element) {
        element.style.fill = evt.data["value"];
      });
      let icons = document.getElementsByClassName("icon");
      icons.forEach(function(element) {
        element.style.fill = evt.data["value"];
      });
    }
  }

};

function sendMessage(data) {
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    // Send the data to peer as a message
    messaging.peerSocket.send(data);
  }
}


// CLOCK

const clockDisplay = document.getElementById("clockDisplay");

// Update the clock every minute
clock.granularity = "minutes";

// Update the the clockface every tick with the current time
clock.ontick = (evt) => {
  //aks companion for new values from nightscout
  sendMessage({"getValues": true});
  
  let today = evt.date;
  let hours = today.getHours();
  if (preferences.clockDisplay === "12h") {
    // 12h format
    hours = hours % 12 || 12;
  } else {
    // 24h format
    hours = util.zeroPad(hours);
  }
  let mins = util.zeroPad(today.getMinutes());
  //update clock
  clockDisplay.text = `${hours}:${mins}`;
  
  //update minutes since last value
  minutesAgoDisplay.text = calculateMinutesAgo(lastValueDate) + "m";
};

function calculateMinutesAgo(date){
  let minutes = 99;
  try {
    let minute = 1000.0 * 60.0;
    let timeNow = new Date().getTime();
    let timeValue = Date.parse(date.toString());
    minutes = Math.round((timeNow - timeValue)/minute);
  } catch (err) {
    console.log(err);
  }
  return minutes;
}


// Battery display
const batteryLine = document.getElementById("batteryLine");

battery.onchange = (charger, evt) => {
  updateBatteryDisplay();
};

charger.onchange = (charger, evt) => {
};

function updateBatteryDisplay(){
  batteryLine.width = battery.chargeLevel * 3;
  if (battery.chargeLevel < 31){
    batteryLine.style.fill = "yellow";
  }
  if (battery.chargeLevel < 15){
    batteryLine.style.fill = "red";
  }
  if (battery.chargeLevel > 30) {
    batteryLine.style.fill = "white";
  }
}


// SEND CARBS TO NIGHTSCOUT
var carbs = 0;

const plusButton = document.getElementById("plusButton");
const minusButton = document.getElementById("minusButton");
const carbDisplay = document.getElementById("carbs");

plusButton.onactivate = function(evt) {
  carbs++;
  updateCarbDisplay();
};

minusButton.onactivate = function(evt) {
  if(carbs > 0){
    carbs--;
  }
  updateCarbDisplay();
};

function updateCarbDisplay(){
  carbDisplay.text = carbs;
}

const sendButton = document.getElementById("sendButton");
const isOkDisplay = document.getElementById("isOk");

sendButton.onactivate = function(evt) {
  sendCarbs();
};

function sendCarbs() {
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    // Send the data to peer as a message
    let requestDate = new Date();
    messaging.peerSocket.send({
      getValues: false,
      carbData: carbs,
      date: requestDate.toString()
    });
    carbs = 0;
    updateCarbDisplay();
  }
}

function showIfCarbsUploaded(data){
  if(data["isOk"] == false){
    console.log("carbs not uploaded"); // do something to show it didnt work
    isOkDisplay.text = "error";
    isOkDisplay.style.fill = "red";
    isOkDisplay.style.display = "inline";
    carbDisplay.style.display = "none";
    setTimeout(function() {
      isOkDisplay.style.display = "none";
      carbDisplay.style.display = "inline";
    }, 5000);
  } else {
    console.log("carbs uploaded"); // do something to show it worked
    isOkDisplay.text = "uploaded";
    isOkDisplay.style.fill = "green";
    isOkDisplay.style.display = "inline";
    carbDisplay.style.display = "none";
    setTimeout(function() {
      isOkDisplay.style.display = "none";
      carbDisplay.style.display = "inline";
    }, 3000);
    setTimeout(function() {
      for(let i=0;i<carbsViewElements.length;i++){
        carbsViewElements[i].style.display = "none";
      }
    }, 3000);
  }
}


