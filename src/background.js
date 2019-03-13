'use strict';
const historyDays = 14;
const maxResults = 300*historyDays;
const minVisitsToCount = 2

function fetchVisits(url, sinceDaysAgo, callback) {
  chrome.history.getVisits({"url":url}, function(historyItems) {

    let startTime = new Date();
    startTime.setDate(startTime.getDate() - sinceDaysAgo);
    const filteredItems = historyItems.filter(item => item.visitTime >= startTime.getTime());

    callback(filteredItems);
  });
}

function compare(a,b) {
  if (a.count < b.count)
      return 1;
  if (a.count > b.count)
      return -1;
  return 0;
}

function quarterForTime(visitTime) {
  const visitDate = new Date(visitTime)  
  const hourOfDay = visitDate.getHours(); //0-23
  const minutesOfHour = visitDate.getMinutes(); //0-59

  const quarter = hourOfDay*4 + Math.floor(minutesOfHour/15);
  return quarter;
}

// storage will contain objects which will represent batches of visits within small timeframe
// we can batch data into 15 minutes batches (24*4 = 96 batches per day)
// history will contain 7 or 14 days, to decide
// monday 0:00 will be visits_0_0
// tuesday 1:00 will be visits_1_4

function refreshHistory() {
  
  //create initial empty dictionary to store visits
  let initialDictionaryOfVisits = {};
  for (let day = 0; day < 7; day++) { //7 days per week
    for (let quarter = 0; quarter < 96; quarter++) { //96 quarters per day
    initialDictionaryOfVisits["visits_"+day+"_"+quarter]=[];
    }
  }

  //set start date to filter visits
  let startTime = new Date();
  startTime.setDate(startTime.getDate() - historyDays);

  const searchParams = {text: "", startTime:startTime.getTime(), maxResults: maxResults};

  chrome.history.search(searchParams, function(historyItems) {
  
    let arrayOfMostVisited = [];
    const filteredItems = historyItems.filter(item => item.visitCount >= minVisitsToCount);
    filteredItems.forEach(function(element, itemsIndex) {

      fetchVisits(element.url, historyDays, function(visits) {
        
        arrayOfMostVisited.push({"url":element.url, "count":visits.length});
        
        visits.forEach(function(visitObject, visitsIndex) {
          visitObject.url = element.url;
          const visitDate = new Date(visitObject.visitTime)  
          const dayOfWeek = visitDate.getDay(); //0-6 (Sunday is 0)
          const quarterOfDay = quarterForTime(visitDate); //0-96
          const key = "visits_"+dayOfWeek+"_"+quarterOfDay;

          const cleanedVisitObject = {"url": visitObject.url};
          initialDictionaryOfVisits[key].push(cleanedVisitObject);
        });

        if (itemsIndex == filteredItems.length-1) {
          const sortedMostVisited = arrayOfMostVisited.sort(compare).slice(0,10);  
          chrome.storage.local.set({"visits": initialDictionaryOfVisits, "lastSync":(new Date()).getTime(), "topVisits":sortedMostVisited}, function() {
          });
        }
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(function() {
  refreshHistory();
});

chrome.tabs.onCreated.addListener(function(tab) {
  chrome.storage.local.get(["lastSync"], function(lastSyncTimestampDictionary) {
    const lastSyncTimestamp = lastSyncTimestampDictionary["lastSync"];
    const sinceLastUpdate = Math.abs((new Date()) - (new Date(lastSyncTimestamp)));
    const hoursSinceLastUpdate = sinceLastUpdate / 36e5;
    if (hoursSinceLastUpdate>24.0) {
      refreshHistory();
    }
  });
});