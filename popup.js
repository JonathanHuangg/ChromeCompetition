document.getElementById("openLocalTab").addEventListener("click", function() {
    chrome.tabs.create({ url: chrome.runtime.getURL("localhostTab.html") });
});
