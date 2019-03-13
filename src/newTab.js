const quartersToCount = 5;

function quarterForTime(visitTime) {
    let visitDate = new Date(visitTime)  
    let hourOfDay = visitDate.getHours(); //0-23
    let minutesOfHour = visitDate.getMinutes(); //0-59
  
    let quarter = hourOfDay*4 + Math.floor(minutesOfHour/15);
    return quarter;
}

function compare(a,b) {
    if (a.count < b.count)
        return 1;
    if (a.count > b.count)
        return -1;
    return 0;
}

function extractHostname(url) {
    let hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    hostname = hostname.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    return hostname;
}

function addTile (fullURL, baseURL) { 
    let currentDiv = document.getElementById("grid"); 
    let newDiv = document.createElement("a"); 
      
    newDiv.innerHTML = baseURL;
    newDiv.href = fullURL;
    newDiv.className = "box";

    currentDiv.appendChild(newDiv);
}

function getVisits(day, quarter, dictionaryOfVisits) {
    let visitsDay = day;
    let visitsQuarter = quarter;

    if (visitsQuarter < 0) {
        visitsQuarter = 96 + visitsQuarter;
        visitsDay = visitsDay - 1;
        if (visitsDay < 0) {
            visitsDay = 6;
        }
    } else if (visitsQuarter > 95) {
        visitsQuarter = visitsQuarter - 96;
        visitsDay = visitsDay + 1;
        if (visitsDay > 6) {
            visitsDay = 0;
        }
    }

    const visits = dictionaryOfVisits["visits_"+visitsDay+"_"+visitsQuarter];
    return visits;
}
  
chrome.storage.local.get(["visits"], function(dictionaryOfVisits) {

    //filter a 1 hour timeframe (last 2 quarters and 2 next)
    const dictionary = dictionaryOfVisits["visits"];
    let startTime = new Date();

    const currentDayOfWeek = startTime.getDay();
    const currentQuarter = quarterForTime(startTime);

    let arrayOfVisits = [];
    for(let i=0; i<quartersToCount; i++) {
        arrayOfVisits = arrayOfVisits.concat(getVisits(currentDayOfWeek, currentQuarter+i-Math.floor(quartersToCount/2), dictionary));
    }
    
    let justURLs = arrayOfVisits.map(x => x.url);

    //dictionary where URL is key and visits count is value
    const distribution = justURLs.reduce((acum,cur) => Object.assign(acum,{[cur]: (acum[cur] | 0)+1}),{});

    //change distribution dictionary into array of dictionaries
    let arr = [];
    for(let i in distribution) {
        if(!distribution.hasOwnProperty(i)) continue;
        arr.push({"url":i,"count":distribution[i], "baseURL":extractHostname(i)});
    }

    //sort so those visited more are first
    let sorted = arr.sort(compare);  
    
    //remove duplicates (objects with the same base URL)
    let noDuplicates = [];
    const map = new Map();
    for (const item of sorted) {
        if(!map.has(item.baseURL)) {
            map.set(item.baseURL, true);
            noDuplicates.push(item);
        }
    }

    // show only up to 9 tiles
    if(noDuplicates.length>9) {
        noDuplicates = noDuplicates.splice(0,9);
    }

    //create tile for each visit object
    noDuplicates.forEach(function(visitObject, visitsIndex) {
        addTile(visitObject.url, visitObject.baseURL);
    })

    //fill up to 9 tiles with general most visited websites (within last 2 weeks)
    if (noDuplicates.length < 9) {
        chrome.storage.local.get(["topVisits"], function(dictionaryOfTopVisits) {
            const topVisitsArray = dictionaryOfTopVisits["topVisits"];
            for(let i=0; (i+noDuplicates.length)<9; i++) {
                const fullURL = topVisitsArray[i].url;
                const baseURL = extractHostname(fullURL);
                addTile(fullURL, baseURL);
            }
        });
    }
});