// maintain state, perform operations in the background

// General pseudocode

/*

Note: Instead of every call, use debouncing for performance improvements
Introduce a lock like isUpdating for all of the listeners
1) Use listeners 
    a) chrome.tabs.onActivated - track changes in active tabs
    b) chrome.tabs.onUpdated - track changes in url per tab
    c) chrome.windows.onFocusChanged - track changes in windows
    d) chorme.tabs.onRemoved - track changes in closedTabs. Actually don't need this 
    because if you delete a tab, you will call chrome.tabs.onActivated. If it is the last
    one, you are calling chrome.windows.onRemoved().
    e) chrome.windows.onRemoved - to clean the windows dictionary
2) Sync using chrome.storage APIs. Try to save the dictionary on every event.
3) Create a dictionary that has key = windowId, value = CurrTab object
4) Battle race conditions by doing console.log() and then checking the logs

Example:

1)Tab A opens. Get the dictionary from storage, dic[windowId] = (TabAURL, timestamp). End all 
other possible sessions of windowId, setting up endTimes for all of them (if they exist)

2)Tab B opens in the same window. Get the dictionary from storage. dic[windowId] = (TabBURL, timestamp). 
Tab A's object gets ejected and elapsed time is saved. 

3) Tab C opens in a different window. Get dictionary from storage. 
End all other window sessions (Tab B gets ejected and saved)

4) Delete Tab A by clicking "x". No change. If A was active, end its session.

5) Command-shift-T, tab is onActivated, Get the dictionary from storage, other windows all get 
cleaned out from the dictionary and the elapsed times are saved. 


Storage dictionary structure:

{ url1: [totalElapsedTime, [TimeObject1 OPEN, TimeObject2 CLOSE, ...]],
url2: [totalElapsedTime, [TimeObject1 OPEN, TimeObject2 CLOSE, ...]],
url3: [totalElapsedTime, [TimeObject1 OPEN, TimeObject2 CLOSE, ...]]
}
*/


// this is the client side TimeObject
class TimeObject {
    constructor(url, timestamp, event, windowID) {

        if (!url || !timestamp || !event) {
            throw new Error("Missing one of the parameters");
        }

        this.url = url;
        this.domain = this.getDomain(url);
        this.timestamp = timestamp;
        this.event = event;
        this.windowID = windowID
    }

    getDomain(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname;
        } catch (error) {
            console.error("Invalid URL:", error.message);
            return null;
        }
    }
    logTimestamp() {
        console.log(`${this.event} event at Timestamp: ${this.timestamp} 
            for domain ${this.domain} with the url: ${this.url}`)
    }

    static computeDifference(TimeObject1, TimeObject2) {
        const elapsedTime = Math.abs(TimeObject1.timestamp - TimeObject2.timestamp)
        return elapsedTime;
    }
}

// Introduce locking
let dictionarylockInUse = false

async function dictionaryAcquireLock() {
    while (dictionarylockInUse) {
        await new Promise(resolve => setTimeout(resolve, 10)); // add 10 ms just for safety
    }
    dictionarylockInUse = true;
}

function dictionaryReleaseLock() {
    dictionarylockInUse = false;
}

// dictionary for windowID
let windows = {}; // key = windowID, val = timestamp object
let previousFocusedWindowId = chrome.windows.WINDOW_ID_NONE;
// introduce the listeners

function debounce(func, delay) {
    let timer;
    return function (...args) {
        const context = this;
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(context, args), delay);
    };
}
chrome.tabs.onActivated.addListener(debounce (async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (!tab.url) {
            console.warn("There is no tab url");
            return;
        }
        const now = Date.now();
        await addStartEndToDictionary(activeInfo.tabId, now, tab.windowId, tab.url);
    } catch (error) {
        console.log("OnActivated listener failed: ", error.message);
    }
}, 100))
/*
Need to update the current URL with an end, create a new timeObj for the new url
*/
chrome.tabs.onUpdated.addListener(debounce (async (tabId, newInfo, tab) => {
    if (newInfo.url && tab.status == "complete") {
        try {
            if (!tab.url) {
                console.warn("There is no tab url");
                return;
            }
            const now = Date.now()
            await addStartEndToDictionary(tabId, now, tab.windowId, tab.url);
            
        } catch (error) {
            console.log("On update listener failed: ", error)
        }
    } 
}, 100));


/*
1) get the dictionary
2) Add new timeObj to the dictionary[url]
3) clean out windows by adding it to the dictionary
4) reset windows
*/
async function addStartEndToDictionary(tabId, timeStamp, windowId, url) {
    try {
        await dictionaryAcquireLock();
        const tab = await chrome.tabs.get(tabId);
        const newOpenTab = new TimeObject(url, timeStamp, "OPEN", windowId);

        const res = await chrome.storage.local.get("dictionary");
        const dictionary = res.dictionary || {};
        if (!dictionary[url]) {
            dictionary[url] = [0, [newOpenTab]];
        } else {
            dictionary[url][1].push(newOpenTab);
        }

        for (const [windowID, value] of Object.entries(windows)) {
            if (windowID == String(windowId)) {
                continue;
            }
            try { 
                const elapsedTime = TimeObject.computeDifference(value, newOpenTab);
                const endTab = new TimeObject(value.url, newOpenTab.timestamp, "CLOSE", windowID);

                if (dictionary[value.url]) {
                    dictionary[value.url][0] += elapsedTime;
                    dictionary[value.url][1].push(endTab);
                } else {
                    console.error(`There is no value in dictionary where key is ${value.url}`);
                }
            } catch(error) {
                console.error("Close objects are being added when the dictionary doesn't exist. Error: ", error);
            }
        }
        windows[windowId] = newOpenTab;
        await chrome.storage.local.set({ dictionary });

    } catch (error) {
        console.error("Error in addStartEndToDictionary: ", error);
    } finally {
        dictionaryReleaseLock();
    }
}

/*
If the focus changes for the window, in the windows dict, 
find where the window you left from. The last item should be an "OPEN" timeObj.
Add a "CLOSE" timeObj to it.
Add an "OPEN" for the new Window
*/
chrome.windows.onFocusChanged.addListener(debounce(async (windowId) => {
    const now = Date.now();

    try {
        await dictionaryAcquireLock();

        const res = await chrome.storage.local.get("dictionary");
        const dictionary = res.dictionary || {};
        
        // window that you leave from
        if (previousFocusedWindowId !== chrome.windows.WINDOW_ID_NONE) {
            const openTimeObj = windows[previousFocusedWindowId];

            if (openTimeObj && openTimeObj.url) {
                const prevWindowEntry = dictionary[openTimeObj.url];

                if (prevWindowEntry && prevWindowEntry[1].length > 0) {
                    const lastTimeObj = prevWindowEntry[1][prevWindowEntry[1].length - 1];
                    if (lastTimeObj.event == "OPEN") {
                        const closeTimeObj = new TimeObject(openTimeObj.url, now, "CLOSE", previousFocusedWindowId);

                        const elapsedTime = TimeObject.computeDifference(lastTimeObj, closeTimeObj);
                        dictionary[openTimeObj.url][0] += elapsedTime;

                        dictionary[openTimeObj.url][1].push(closeTimeObj);
                    }
                }
                windows[previousFocusedWindowId] = null;
            } else {
                console.error("OnFocusChanged failed. The openTimeObject was not saved in the window hashmap");
            }
        }
        
        // new window that gained focus
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {

            const[activeTab] = await chrome.tabs.query({ active: true, windowId: windowId});

            if (activeTab && activeTab.url) {
                const activeURL = activeTab.url;
                const openTimeObj = new TimeObject(activeURL, now, "OPEN", windowId);
                windows[windowId] = openTimeObj;

                if (!dictionary[activeURL]) {
                    dictionary[activeURL] = [0, [openTimeObj]];
                } else {
                    dictionary[activeURL][1].push(openTimeObj);
                }
            } else {
                console.warn(`No active tab found for window ID: ${windowId}`);
                windows[windowId] = null;
            }
        }

        await chrome.storage.local.set({ dictionary });

        previousFocusedWindowId = windowId;
    } catch (error) {
        console.error("Error in OnFocusChanged listener: ", error.message);
    } finally {
        dictionaryReleaseLock();
    }

}, 100));

/*
Add a closeTimeObj and add the elapsed time for the window that you just deleted
*/
chrome.windows.onRemoved.addListener(debounce(async (windowId) => {
    if (windows[windowId] == null) {
        console.error("Something is wrong. A window was deleted but it was never originally recorded");
    }
    const now = Date.now();
    const openObj = windows[windowId];
    try {
        await dictionaryAcquireLock();
        const closeTimeObj = new TimeObject(openObj.url, now, "CLOSE", windowId);

        const res = await chrome.storage.local.get("dictionary");
        const dictionary = res.dictionary || {};
        if (dictionary == null) {
            console.error("Something is wrong. There is no dictionary in storage");
            return;
        }

        if (!dictionary[closeTimeObj.url]) {
            console.error("Something is wrong. The dictionary entry for deleted window does not exist");
            return;
        }
        const elapsedTime = TimeObject.computeDifference(openObj, closeTimeObj);
        dictionary[closeTimeObj.url][0] += elapsedTime;
        dictionary[closeTimeObj.url][1].push(closeTimeObj);
        await chrome.storage.local.set({ dictionary });
        delete windows[windowId];
    } catch (error) {
        console.error("OnRemoved failed with error ", error);
    } finally {
        dictionaryReleaseLock();
    }
}, 100));