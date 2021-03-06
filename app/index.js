import clock from "clock";
import document from "document";
import { preferences } from "user-settings";
import * as util from "../common/utils";
import * as messaging from "messaging";
import { battery } from "power";
import { charger } from "power";
import { vibration } from "haptics";

// Initialize
var lastValueDate = new Date(2018,1,1);
const second = 1000;
const minute = 60 * second;


// CHANGE PAGES
const cobIcon = document.getElementById("changeToCarbsView");
const carbsViewElements = document.getElementsByClassName("carbsView");
const carbsViewBack = document.getElementById("backButton");
const changeToTempTargetView = document.getElementById("changeToTempTargetView");
const tempTargetView = document.getElementById("tempTargetView");
const backFromTargetView = tempTargetView.getElementById("backTargetButton");


cobIcon.onclick = function(evt){
  for(let i=0;i<carbsViewElements.length;i++){
    carbsViewElements[i].style.display = "inline";
  }
};

carbsViewBack.onactivate = function(evt) {
  for(let i=0;i<carbsViewElements.length;i++){
    carbsViewElements[i].style.display = "none";
  }
  carbs = 0;
  updateCarbDisplay();
};

changeToTempTargetView.onclick = function(evt) {
  tempTargetView.style.display = "inline";
};

backFromTargetView.onclick = function(evt) {
  target = 100;
  targetMinutes = 60;
  updateTargetDisplay();
  tempTargetView.style.display = "none";
};

//Initializing
//const background = document.getElementsByClassName("background");
//const text = document.getElementsByClassName("text");

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
    try {
      bgDisplay.text = evt.data["bg"];
      tickDisplay.text = evt.data["tick"];
      iobDisplay.text = evt.data["iob"];
      cobDisplay.text = evt.data["cob"];
      lastValueDate = evt.data["dateOfValue"];
      minutesAgoDisplay.text = calculateMinutesAgo(lastValueDate) + "m";
      minutesAgoDisplay.style.fill = "white";
    } catch (err) {
      console.log("couldn't update clockface from nightscout data");
    }

  }

  if(evt.data["type"] == "nsResponse"){
    showIfCarbsUploaded(evt.data);
  }

  if(evt.data["type"] == "nsTempResponse") {
      showIfTempTargetSet(evt.data);
  }

  if(evt.data["type"] == "settings"){
    console.log(JSON.stringify(evt.data));
    if(evt.data["key"] == "colorBackground"){
      let bgColor = document.getElementById("bgColor");
      bgColor.style.fill = evt.data["value"];
      cobIcon.style.fill = evt.data["value"];
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
    let currTime = new Date();
    let lastValue= Date.parse(lastValueDate);
    // update values from nightscout if last value is more than 4 minutes ago
    if (currTime - lastValue > 4 * minute){
        console.log("send update from nightscout request to companion");
        minutesAgoDisplay.style.fill = "orange";
        sendMessage({"getValues": true});
    }

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
    try {
    minutesAgoDisplay.text = calculateMinutesAgo(lastValueDate) + "m";
    } catch (err) {
    console.log(err);
    }
};

function calculateMinutesAgo(date){
  let minutes = 99;
  if (date != null){
    let minute = 1000.0 * 60.0;
    let timeNow = new Date().getTime();
    let timeValue = Date.parse(date.toString());
    minutes = Math.round((timeNow - timeValue)/minute);
  } else {
    console.log("date was null");
  }
  if (minutes > 99) {
      minutes = 99;
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
const plusFiveButton = document.getElementById("plusFiveButton");
const minusFiveButton = document.getElementById("minusFiveButton");
const carbDisplay = document.getElementById("carbs");
const confirm = document.getElementById("popup");
const carbsViewBackground = document.getElementById("carbsBackground");

plusButton.onactivate = function(evt) {
  carbs++;
  updateCarbDisplay();
};
plusFiveButton.onactivate = function(evt) {
  carbs = carbs + 5;
  updateCarbDisplay();
};

minusButton.onactivate = function(evt) {
  if(carbs > 0){
    carbs--;
  }
  updateCarbDisplay();
};

minusFiveButton.onactivate = function(evt) {
  if(carbs >= 5){
    carbs = carbs -5;
  } else if (carbs > 0){
    carbs = 0;
  }
  updateCarbDisplay();
};

function updateCarbDisplay(){
  carbDisplay.text = carbs;
}

const sendButton = document.getElementById("sendButton");
const isOkDisplay = document.getElementById("isOk");

sendButton.onactivate = function(evt) {
  showConfirmPopup("carbs");
};

function showConfirmPopup(carbsOrTarget) {
  console.log("confirmation pop up function started");
  confirm.style.display = "inline";

  let btnLeft = confirm.getElementById("btnLeft");
  let btnRight = confirm.getElementById("btnRight");

  let confirmText  = confirm.getElementById("confirmText");
  let confirmTextCopy =  confirmText.getElementById("copy");

  if (carbsOrTarget == "carbs") {
      confirmTextCopy.text = "Do you really want to upload " + carbs + "g of carbs to Nightscout?";
  } else {
      confirmTextCopy.text = "Do you really want to set temp target to " + target + " for " + targetMinutes + " m?";
  }

  btnLeft.onclick = function(evt) {
    confirm.style.display = "none";
  };

  btnRight.onclick = function(evt) {
    confirm.style.display = "none";
    if (carbsOrTarget == "carbs") {
        isOkDisplay.text = "wait";
        isOkDisplay.style.display ="inline";
        carbDisplay.style.display = "none";
        sendCarbs();
    } else {
        targetDisplay.text = "wait";
        targetMinutesDisplay.text = "";
        sendTempTarget();
    }
  }
}

function sendCarbs() {
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    // Send the data to peer as a message
    let requestDate = new Date();
    messaging.peerSocket.send({
        getValues: false,
        sendCarbs: true,
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
    isOkDisplay.style.fill = "black";
    isOkDisplay.style.display = "inline";
    carbDisplay.style.display = "none";
    carbsViewBackground.style.fill = "red";
    vibration.start("ring");
    setTimeout(function() {
      isOkDisplay.style.display = "none";
      carbDisplay.style.display = "inline";
      carbsViewBackground.style.fill = "white";
      vibration.stop();
    }, 5000);
  } else {
    console.log("carbs uploaded"); // do something to show it worked
    isOkDisplay.text = "uploaded";
    isOkDisplay.style.fill = "black";
    isOkDisplay.style.display = "inline";
    carbDisplay.style.display = "none";
    carbsViewBackground.style.fill = "green";
    vibration.start("confirmation-max");
    setTimeout(function() {
      isOkDisplay.style.display = "none";
      carbDisplay.style.display = "inline";
      carbsViewBackground.style.fill = "white";
      vibration.stop();
    }, 3000);
  }
  //go back to main view
  setTimeout(function() {
    for(let i=0;i<carbsViewElements.length;i++){
      carbsViewElements[i].style.display = "none";
    }
  }, 3000);
}


// TARGET VIEW

// Interface:
var target = 100;
var targetMinutes = 60;

const plusTarget = document.getElementById("plusTarget");
const plusTimeTarget = document.getElementById("plusTimeTarget");
const minusTarget = document.getElementById("minusTarget");
const minusTimeTarget = document.getElementById("minusTimeTarget");
const sendTarget = document.getElementById("sendTarget");

const targetDisplay = document.getElementById("target");
const targetMinutesDisplay = document.getElementById("targetMinutes");

plusTarget.onclick = function(evt) {
  if (target < 240){
    target = target + 5;
  }
  updateTargetDisplay();
};

plusTimeTarget.onclick = function(evt) {
  targetMinutes = targetMinutes + 5;
  updateTargetDisplay();
};

minusTarget.onclick = function(evt) {
  if(target >= 75){
    target = target - 5;
  }
  updateTargetDisplay();
};

minusTimeTarget.onclick = function(evt) {
  if(targetMinutes > 5) {
    targetMinutes = targetMinutes - 5;
  }
  updateTargetDisplay();
};

sendTarget.onclick = function(evt) {
  console.log("sendTarget button clicked");
  showConfirmPopup("target");
};


function updateTargetDisplay(){
  targetDisplay.text = target;
  targetMinutesDisplay.text = targetMinutes + "m";
}

// Send Target to Nightscout

function sendTempTarget() {
    if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
        // Send the data to peer as a message
        let requestDate = new Date();
        messaging.peerSocket.send({
            getValues: false,
            sendCarbs: false,
            tempTarget: target,
            tempTargetMinutes: targetMinutes,
            date: requestDate.toString()
        });
    }
}

function showIfTempTargetSet(data) {
    let tempTargetBackground = document.getElementById("tempTargetBackground");
    if (data["isOk"] == false) {
        targetDisplay.text = "err";
        targetMinutesDisplay.text = "";
        tempTargetBackground.style.fill = "red";
        vibration.start("ring");
        setTimeout(function() {
            tempTargetBackground.style.fill = "white";
            tempTargetView.style.display = "none";
            targetDisplay.text = target;
            targetMinutesDisplay.text = targetMinutes;
            vibration.stop();
        }, 5000);
    } else {
        tempTargetBackground.style.fill = "green";
        targetDisplay.text = "ok";
        targetMinutesDisplay.text = "";
        vibration.start("confirmation-max");
        setTimeout(function() {
            tempTargetBackground.style.fill = "white";
            tempTargetView.style.display = "none";
            targetDisplay.text = target;
            targetMinutesDisplay.text = targetMinutes;
            vibration.stop();
        }, 3000);
    }
}
