document.getElementById("openTabButton").addEventListener("click", function() {
    chrome.tabs.create({ url: "http://localhost:3000" }); 
  });