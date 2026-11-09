// maintain state, perform operations in the background

// General pseudocode

/*

Note: bursts of the same event are coalesced with a leading-edge throttle
(no timers: a service worker can be terminated before a setTimeout fires).
Storage read-modify-writes are serialized with a promise-chain lock so two
concurrent listeners cannot read the same dictionary and drop each other's
session.
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

// Only real web pages are tracked. Browser pages (chrome://, about:), the
// extension's own pages and blank tabs have no meaningful domain and would
// pollute every chart. Keep in sync with isTrackableUrl in dictionary.js,
// which the dashboard and popup use for the same check.
function isTrackableUrl(url) {
    if (typeof url !== "string") return false;
    try {
        const protocol = new URL(url).protocol;
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
}

// Serialize storage read-modify-writes. The listeners fire concurrently,
// and without this two handlers could read the same dictionary and the
// second one's write would silently drop the first one's session. This is
// a promise chain, not a flag plus setTimeout: a timer-based lock can be
// lost if the service worker is terminated while waiting.
let dictionaryQueue = Promise.resolve();

function withDictionaryLock(task) {
    const run = dictionaryQueue.then(async () => {
        // Every write waits for the startup restore, so no handler can run
        // against an empty `windows` map while the real open sessions are
        // still being loaded back from storage.
        await windowsReady;
        return task();
    });
    // Keep the chain alive past a failure so one bad event cannot wedge
    // every later write.
    dictionaryQueue = run.catch(() => {});
    return run;
}

// dictionary for windowID
let windows = {}; // key = windowID, val = timestamp object
let previousFocusedWindowId = chrome.windows.WINDOW_ID_NONE;

// The service worker is stopped when idle and restarted on the next event,
// which wipes the in-memory `windows` map. Open sessions are therefore
// persisted in storage alongside the dictionary and restored on startup,
// so a restart mid-session does not lose the open session (before this,
// the session dangled and the dashboard counted it as open forever).
let windowsReady = restoreOpenSessions();

async function restoreOpenSessions() {
    try {
        const { openSessions, dictionary = {} } = await chrome.storage.local.get([
            "openSessions",
            "dictionary",
        ]);
        if (!openSessions || typeof openSessions !== "object") return;
        const liveWindows = await chrome.windows.getAll();
        const liveIds = new Set(liveWindows.map((window) => String(window.id)));
        const focusedWindow = liveWindows.find((window) => window.focused);
        if (focusedWindow) {
            previousFocusedWindowId = focusedWindow.id;
        }
        windows = {};
        let staleClosed = false;
        for (const [windowId, openSession] of Object.entries(openSessions)) {
            if (liveIds.has(windowId)) {
                windows[windowId] = openSession;
            } else {
                staleClosed = closeStaleSession(dictionary, openSession) || staleClosed;
            }
        }
        if (staleClosed) {
            await persistState(dictionary);
        }
    } catch (error) {
        console.error("Error restoring open sessions: ", error);
    }
}

// A session whose window is gone (browser restarted, or the window closed
// while the worker was down) can never be closed by an event. End it where
// it started: the page opening was observed, but how long it stayed open
// was not, so no elapsed time is recorded for it rather than inventing
// any. Returns true when it closed a session.
function closeStaleSession(dictionary, openSession) {
    if (!openSession || !openSession.url) return false;
    const entry = dictionary[openSession.url];
    if (!entry || !Array.isArray(entry[1])) return false;
    const lastEvent = entry[1][entry[1].length - 1];
    if (!lastEvent || lastEvent.event !== "OPEN") return false;
    entry[1].push(
        new TimeObject(openSession.url, openSession.timestamp, "CLOSE", openSession.windowID),
    );
    return true;
}

// Persist the recorded history and the sessions still open in one write,
// so a worker restart can never observe one without the other.
function persistState(dictionary) {
    return chrome.storage.local.set({ dictionary, openSessions: windows });
}

// introduce the listeners

// Coalesce bursts of the same event (one navigation fires several updates)
// by running the first call immediately and ignoring repeats for `delay`
// ms. The old debounce deferred the work behind setTimeout, which a
// service worker can be terminated before firing, silently dropping the
// event. This version uses only the clock, so no work is ever deferred.
function throttleLeading(func, delay) {
    let lastRun = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastRun >= delay) {
            lastRun = now;
            func.apply(this, args);
        }
    };
}
chrome.tabs.onActivated.addListener(throttleLeading(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        // A blank tab has not gone anywhere yet: the navigation that follows
        // will report the real URL. Closing the previous session here would
        // race that navigation, so a blank tab is a no-op.
        if (!tab.url || tab.url === "about:blank") {
            return;
        }
        const now = Date.now();
        // Switching to a page we don't track (e.g. chrome://) still ends
        // the previous tab's session, so its time stops accruing instead
        // of running until the next tracked tab.
        if (!isTrackableUrl(tab.url)) {
            await closeAllOpenSessions(now);
            return;
        }
        await addStartEndToDictionary(now, tab.windowId, tab.url);
    } catch (error) {
        console.log("OnActivated listener failed: ", error.message);
    }
}, 100))
/*
Need to update the current URL with an end, create a new timeObj for the new url.
Fires on newInfo.url, not on status "complete": Chrome reports the URL
change and the load completing in separate onUpdated events, so requiring
both in the same event meant same-tab navigation was never recorded.
Deliberately not throttled: a new tab reports about:blank and then the real
URL within milliseconds, and a leading-edge throttle would keep the first
and drop the second, losing the navigation entirely. URL changes are
already rare (one per navigation), so there is nothing to coalesce.
*/
chrome.tabs.onUpdated.addListener(async (tabId, newInfo, tab) => {
    // See onActivated: a blank tab has not gone anywhere yet.
    if (!newInfo.url || newInfo.url === "about:blank") {
        return;
    }
    try {
        const now = Date.now()
        if (!isTrackableUrl(newInfo.url)) {
            await closeAllOpenSessions(now);
            return;
        }
        await addStartEndToDictionary(now, tab.windowId, newInfo.url);
    } catch (error) {
        console.log("On update listener failed: ", error)
    }
});


/*
1) get the dictionary
2) Add new timeObj to the dictionary[url]
3) Close every session that was open, including the previous tab in this
   same window, recording the elapsed time for each
4) reset windows
*/
function addStartEndToDictionary(timeStamp, windowId, url) {
    return withDictionaryLock(async () => {
        try {
            const newOpenTab = new TimeObject(url, timeStamp, "OPEN", windowId);

            const res = await chrome.storage.local.get("dictionary");
            const dictionary = res.dictionary || {};
            if (!dictionary[url]) {
                dictionary[url] = [0, [newOpenTab]];
            } else {
                dictionary[url][1].push(newOpenTab);
            }

            closeOpenSessions(dictionary, timeStamp, windowId);
            windows[windowId] = newOpenTab;
            await persistState(dictionary);
        } catch (error) {
            console.error("Error in addStartEndToDictionary: ", error);
        }
    });
}

/*
Close every session currently open in `windows` at `timeStamp`, adding a
CLOSE event and the elapsed time to the dictionary for each. Entries for
other windows are removed once closed, so a session can never be closed
twice; the current window's entry is left for the caller to overwrite with
the new session. A missing dictionary entry for a closing session is logged
instead of crashing the whole update.
*/
function closeOpenSessions(dictionary, timeStamp, currentWindowId) {
    for (const [windowID, value] of Object.entries(windows)) {
        if (!value) {
            continue;
        }
        try {
            const endTab = new TimeObject(value.url, timeStamp, "CLOSE", windowID);
            const elapsedTime = TimeObject.computeDifference(value, endTab);

            if (dictionary[value.url]) {
                dictionary[value.url][0] += elapsedTime;
                dictionary[value.url][1].push(endTab);
            } else {
                console.error(`There is no value in dictionary where key is ${value.url}`);
            }
        } catch (error) {
            console.error("Close objects are being added when the dictionary doesn't exist. Error: ", error);
        }
        if (windowID !== String(currentWindowId)) {
            delete windows[windowID];
        }
    }
}

/*
Close every open session without opening a new one. Used when the user
switches to a page we don't track: the previous tab's time stops accruing
instead of running until the next tracked tab.
*/
function closeAllOpenSessions(timeStamp) {
    return withDictionaryLock(async () => {
        try {
            const res = await chrome.storage.local.get("dictionary");
            const dictionary = res.dictionary || {};
            closeOpenSessions(dictionary, timeStamp);
            await persistState(dictionary);
        } catch (error) {
            console.error("Error in closeAllOpenSessions: ", error);
        }
    });
}

/*
If the focus changes for the window, in the windows dict, 
find where the window you left from. The last item should be an "OPEN" timeObj.
Add a "CLOSE" timeObj to it.
Add an "OPEN" for the new Window
*/
chrome.windows.onFocusChanged.addListener(throttleLeading(async (windowId) => {
    const now = Date.now();

    await withDictionaryLock(async () => {
        try {

            const res = await chrome.storage.local.get("dictionary");
            const dictionary = res.dictionary || {};
        
            // window that you leave from
            if (previousFocusedWindowId !== chrome.windows.WINDOW_ID_NONE) {
                const openTimeObj = windows[previousFocusedWindowId];

                // A missing entry is normal, not an error: a tab switch in the
                // meantime already closed this window's session.
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
                    delete windows[previousFocusedWindowId];
                }
            }
        
            // new window that gained focus
            if (windowId !== chrome.windows.WINDOW_ID_NONE) {

                const[activeTab] = await chrome.tabs.query({ active: true, windowId: windowId});

                if (activeTab && activeTab.url && isTrackableUrl(activeTab.url)) {
                    const activeURL = activeTab.url;
                    const openTimeObj = new TimeObject(activeURL, now, "OPEN", windowId);
                    windows[windowId] = openTimeObj;

                    if (!dictionary[activeURL]) {
                        dictionary[activeURL] = [0, [openTimeObj]];
                    } else {
                        dictionary[activeURL][1].push(openTimeObj);
                    }
                } else if (activeTab && activeTab.url) {
                    // Focused window is on a page we don't track: no new session.
                    delete windows[windowId];
                } else {
                    console.warn(`No active tab found for window ID: ${windowId}`);
                    delete windows[windowId];
                }
            }

            await persistState(dictionary);

            previousFocusedWindowId = windowId;
        } catch (error) {
            console.error("Error in OnFocusChanged listener: ", error.message);
        }
    });

}, 100));

/*
Add a closeTimeObj and add the elapsed time for the window that you just deleted
*/
chrome.windows.onRemoved.addListener(throttleLeading(async (windowId) => {
    const openObj = windows[windowId];
    // A missing entry is normal: focus leaving the window, or a tab switch,
    // already closed this window's session and recorded its time.
    if (!openObj) {
        return;
    }
    const now = Date.now();
    await withDictionaryLock(async () => {
        try {
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
            await persistState(dictionary);
            delete windows[windowId];
        } catch (error) {
            console.error("OnRemoved failed with error ", error);
        }
    });
}, 100));