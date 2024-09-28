let activeTabId = null;
let activeDomain = null;
let activeUrl = null; 

chrome.tabs.onActivated.addListener(function (activeInfo) {
    const currTime = new Date().toISOString();

    chrome.tabs.get(activeInfo.tabId, function (tab) {
        const domain = getDomainFromUrl(tab.url);
        const url = tab.url;  

        if (activeDomain) {
            lostFocus(activeDomain, activeUrl);  
        }

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
            });
        });

        activeTabId = activeInfo.tabId;
        activeDomain = domain;
        activeUrl = url;
    });

    logStorageContents();
});

chrome.windows.onFocusChanged.addListener(function (windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE && activeDomain) {
        lostFocus(activeDomain, activeUrl);
        activeDomain = null;
        activeTabId = null;
        activeUrl = null;
    }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
    if (tabId === activeTabId && activeDomain) {
        lostFocus(activeDomain, activeUrl);
        activeDomain = null;
        activeTabId = null;
        activeUrl = null;
    }
});

function lostFocus(domain, url) {
    const currentTime = new Date().toISOString();

    chrome.storage.local.get(["tabFocusEvents"], function (result) {
        const tabFocusEvents = result.tabFocusEvents || {};

        if (tabFocusEvents[domain] && tabFocusEvents[domain].events.length > 0) {
            const events = tabFocusEvents[domain].events;

            const lastEvent = events[events.length - 1];
            if (lastEvent && !lastEvent.focusEnd) {
                lastEvent.focusEnd = currentTime;

                chrome.storage.local.set({ tabFocusEvents: tabFocusEvents }, function () {
                    console.log("Tab lost focus for domain:", domain, lastEvent);
                });
            }
        }
    });

    activeTabId = null; 
    activeUrl = null;
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
