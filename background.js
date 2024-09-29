// background.js

let currentFocus = null; // Holds the current focus event
let activeTabId = null;  // ID of the active tab

// Helper function to get the domain from a URL
function getDomainFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (error) {
        console.error("Invalid URL: ", error);
        return null;
    }
}

// Start a new focus event
function startFocusEvent(tab) {
    const domain = getDomainFromUrl(tab.url);
    const url = tab.url;
    const currTime = new Date().toISOString();

    if (!domain || domain === "extensions" || domain === "mlgpaokmkbpbhmdebjfajahjfbefbkog") {
        return;
    }

    currentFocus = {
        domain: domain,
        url: url,
        focusStart: currTime,
        focusEnd: null
    };

    // Save the new focus event
    chrome.storage.local.get(["tabFocusEvents"], function (result) {
        const tabFocusEvents = result.tabFocusEvents || {};

        if (!tabFocusEvents[domain]) {
            tabFocusEvents[domain] = {
                domain: domain,
                events: []
            };
        }

        tabFocusEvents[domain].events.push(currentFocus);

        chrome.storage.local.set({ tabFocusEvents: tabFocusEvents }, function () {
            console.log("Started focus event:", currentFocus);
        });
    });

    activeTabId = tab.id;
}

// End the current focus event
function endCurrentFocusEvent() {
    if (!currentFocus) return;

    currentFocus.focusEnd = new Date().toISOString();

    const focusStart = new Date(currentFocus.focusStart);
    const focusEnd = new Date(currentFocus.focusEnd);
    const durationMilliseconds = focusEnd - focusStart;
    const durationSeconds = durationMilliseconds / 1000;

    // Always save the updated event
    chrome.storage.local.get(["tabFocusEvents"], function (result) {
        const tabFocusEvents = result.tabFocusEvents || {};

        // No need to update the event in the array since objects are references
        chrome.storage.local.set({ tabFocusEvents: tabFocusEvents }, function () {
            if (durationSeconds >= 1) {
                console.log("Ended focus event:", currentFocus, "Duration (seconds):", durationSeconds);
            } else {
                console.log("Event too short, duration (seconds):", durationSeconds);
            }
        });
    });

    currentFocus = null;
    activeTabId = null;
}

// Event listener for tab activation
chrome.tabs.onActivated.addListener(function (activeInfo) {
    console.log("Tab activated:", activeInfo);

    // End previous focus event
    endCurrentFocusEvent();

    // Get the new active tab
    chrome.tabs.get(activeInfo.tabId, function (tab) {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }
        startFocusEvent(tab);
    });
});

// Event listener for window focus change
chrome.windows.onFocusChanged.addListener(function (windowId) {
    console.log("Window focus changed:", windowId);

    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // No window is focused
        endCurrentFocusEvent();
    } else {
        // A window has gained focus
        chrome.windows.get(windowId, { populate: true }, function (window) {
            if (chrome.runtime.lastError || !window.focused) {
                console.error(chrome.runtime.lastError);
                return;
            }

            const activeTab = window.tabs.find(tab => tab.active);
            if (activeTab) {
                // End previous focus event
                endCurrentFocusEvent();
                // Start new focus event
                startFocusEvent(activeTab);
            }
        });
    }
});

// Event listener for tab updates (e.g., URL change)
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (tabId === activeTabId && changeInfo.url) {
        console.log("Tab updated with new URL:", changeInfo.url);

        // End current focus event
        endCurrentFocusEvent();

        // Start new focus event with updated URL
        startFocusEvent(tab);
    }
});

// Event listener for tab removal
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    if (tabId === activeTabId) {
        console.log("Active tab closed:", tabId);

        // End current focus event
        endCurrentFocusEvent();
    }
});

// Handle extension suspension (e.g., when the extension is unloaded)
chrome.runtime.onSuspend.addListener(function () {
    console.log("Extension is being suspended.");

    // End any open focus event
    endCurrentFocusEvent();
});

// Optional: Handle extension startup
chrome.runtime.onStartup.addListener(function () {
    console.log("Extension started.");
    // You may want to check for any incomplete events here
});

// Optional: Log storage contents (for debugging)
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

// For debugging purposes, you can log storage when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed, logging storage contents...");
    logStorageContents();
});
