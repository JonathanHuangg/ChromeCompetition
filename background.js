/*

For storing the timestamp
*/
chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
        const focusEvent = {
            url: tab.url,
            timestamp: new Date().toISOString(),
            event: 'tab-selected'
        };

        chrome.storage.local.get(["tabFocusEvents"], function(result) {
            const events = result.tabFocusEvents || [];
            events.push(focusEvent);
            chrome.storage.local.set({ tabFocusEvents: events }, function() {
                console.log("Tab focus event stored", focusEvent);
            });
        });
    });
});