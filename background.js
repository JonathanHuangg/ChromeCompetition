let activeTabId = null;

chrome.tabs.onActivated.addListener(function (activeInfo) {
    const currTime = new Date().toISOString();

    chrome.tabs.get(activeInfo.tabId, function (tab) {
        const domain = getDomainFromUrl(tab.url);
        const focusEvent = {
            focusStart: currTime,
            focusEnd: null
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

        activeTabId = activeInfo.tabId; // Keep track of the active tab
    });

    logStorageContents();

});

// window loses focus
chrome.windows.onFocusChanged.addListener(function (windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        tabLostFocus();
    }
});

// Tab is loses focus
chrome.tabs.onRemoved.addListener(function (tabId) {
    if (tabId === activeTabId) {
        tabLostFocus();
    }
});

function tabLostFocus() {
    const currentTime = new Date().toISOString();

    chrome.storage.local.get(["tabFocusEvents"], function (result) {
        const tabFocusEvents = result.tabFocusEvents || {};

        for (const domain in tabFocusEvents) {
            const events = tabFocusEvents[domain].events;
            const lastEvent = events[events.length - 1];

            if (lastEvent && !lastEvent.focusEnd) {
                lastEvent.focusEnd = currentTime;

                chrome.storage.local.set({ tabFocusEvents: tabFocusEvents }, function () {
                    console.log("Tab lost focus for domain:", domain, lastEvent);
                });

                break; // Stop after updating the first found event
            }
        }
    });

    activeTabId = null; // Reset activeTabId when focus is lost
}

function getDomainFromUrl(url) {
    try {
        const urlObj = new URL(url); 
        return urlObj.hostname;
    } catch (error) {
        console.error("Invalid URL: ", error);
        return null;
    }
}

// Helper function to log all storage contents
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
