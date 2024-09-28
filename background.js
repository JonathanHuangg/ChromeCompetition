let activeTabId = null;
let activeDomain = null;
let activeUrl = null; 

chrome.tabs.onActivated.addListener(function (activeInfo) {
    const currTime = new Date().toISOString();

    chrome.tabs.get(activeInfo.tabId, function (tab) {
        const domain = getDomainFromUrl(tab.url);
        const url = tab.url;  

        if (domain != "extensions" && domain != null && domain != "mlgpaokmkbpbhmdebjfajahjfbefbkog") {
            if (activeDomain) {
                lostFocus(activeDomain, activeUrl).then(function() {
                    // Proceed after lostFocus has completed
                    createFocusEvent(domain, url, currTime, function() {
                        activeTabId = activeInfo.tabId;
                        activeDomain = domain;
                        activeUrl = url;
                    });
                });
            } else {
                // No previous activeDomain, proceed to create focusEvent
                createFocusEvent(domain, url, currTime, function() {
                    activeTabId = activeInfo.tabId;
                    activeDomain = domain;
                    activeUrl = url;
                });
            }
        } else {
            // Domain is to be ignored
            if (activeDomain) {
                lostFocus(activeDomain, activeUrl).then(function() {
                    activeTabId = null;
                    activeDomain = null;
                    activeUrl = null;
                });
            } else {
                activeTabId = null;
                activeDomain = null;
                activeUrl = null;
            }
        }
    });

});

chrome.windows.onFocusChanged.addListener(function (windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE && activeDomain) {
        lostFocus(activeDomain, activeUrl).then(function() {
            activeDomain = null;
            activeTabId = null;
            activeUrl = null;
        });
    } else if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        // Window has gained focus, we may need to restore activeDomain and activeUrl
        chrome.windows.get(windowId, {populate: true}, function(window) {
            if (window.focused) {
                const activeTab = window.tabs.find(tab => tab.active);
                if (activeTab) {
                    const domain = getDomainFromUrl(activeTab.url);
                    const url = activeTab.url;
                    const currTime = new Date().toISOString();

                    if (domain != "extensions" && domain != null && domain != "mlgpaokmkbpbhmdebjfajahjfbefbkog") {
                        createFocusEvent(domain, url, currTime, function() {
                            activeTabId = activeTab.id;
                            activeDomain = domain;
                            activeUrl = url;
                        });
                    } else {
                        activeTabId = null;
                        activeDomain = null;
                        activeUrl = null;
                    }
                }
            }
        });
    }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
    if (tabId === activeTabId && activeDomain) {
        lostFocus(activeDomain, activeUrl).then(function() {
            activeDomain = null;
            activeTabId = null;
            activeUrl = null;
        });
    }
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (tabId === activeTabId && changeInfo.url) {
        const currTime = new Date().toISOString();

        lostFocus(activeDomain, activeUrl).then(function() {
            const domain = getDomainFromUrl(changeInfo.url);
            const url = changeInfo.url;

            if (domain != "extensions" && domain != null && domain != "mlgpaokmkbpbhmdebjfajahjfbefbkog") {
                createFocusEvent(domain, url, currTime, function() {
                    activeDomain = domain;
                    activeUrl = url;
                });
            } else {
                activeDomain = null;
                activeUrl = null;
            }
        });
    }
});

function lostFocus(domain) {
    return new Promise(function(resolve, reject) {
        const currentTime = new Date().toISOString();

        chrome.storage.local.get(["tabFocusEvents"], function (result) {
            const tabFocusEvents = result.tabFocusEvents || {};

            if (tabFocusEvents[domain] && tabFocusEvents[domain].events.length > 0) {
                const events = tabFocusEvents[domain].events;

                const lastEvent = events[events.length - 1];
                if (lastEvent && !lastEvent.focusEnd) {
                    lastEvent.focusEnd = currentTime;

                    const focusStart = new Date(lastEvent.focusStart);
                    const focusEnd = new Date(lastEvent.focusEnd);
                    const durationSeconds = (focusEnd - focusStart) / 1000;
                    // change this if needed
                    if (durationSeconds >= 60) {
                        chrome.storage.local.set({ tabFocusEvents: tabFocusEvents }, function () {
                            console.log("Tab lost focus for domain:", domain, lastEvent, "Duration (seconds):", durationSeconds);
                            resolve();
                        });
                    } else {
                        console.log("Event discarded. Duration (seconds):", durationSeconds);
                        resolve();  
                    }
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    });
}

function createFocusEvent(domain, url, currTime, callback) {
    const focusEvent = {
        focusStart: currTime,
        focusEnd: null,
        url: url  
    };

    chrome.storage.local.get(["tabFocusEvents"], function (result) {
        const tabFocusEvents = result.tabFocusEvents || {};

        if (!tabFocusEvents[domain]) {
            tabFocusEvents[domain] = {
                domain: domain,
                events: []
            };
        }

        tabFocusEvents[domain].events.push(focusEvent);

        chrome.storage.local.set({ tabFocusEvents: tabFocusEvents }, function () {
            console.log("Tab gained focus for domain: ", domain, focusEvent);
            if (callback) callback();
        });
    });
}

function getDomainFromUrl(url) {
    try {
        const urlObj = new URL(url); // Use the URL constructor to parse
        return urlObj.hostname;
    } catch (error) {
        console.error("Invalid URL: ", error);
        return null;
    }
}

function logStorageContents() {
    chrome.storage.local.get(null, function (items) {
        console.log("===== Chrome Storage Contents =====");

        if (Object.keys(items).length === 0) {
            console.log("Storage is empty.");
        } else {
            for (const key in items) {
                if (items.hasOwnProperty(key)) {
                    console.log(`Key: ${key}`);

                    if (typeof items[key] === "object") {
                        console.log("Value (Object): ");
                        console.log(JSON.stringify(items[key], null, 2)); 
                    } else {
                        console.log(`Value: ${items[key]}`);
                    }

                    console.log("-----------------------------------");
                }
            }
        }

        console.log("===== End of Storage Contents =====");
    });
}

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed, logging storage contents...");
    logStorageContents();
});
