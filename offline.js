// This is for testing only

function logStorageContents() {
    chrome.storage.local.get(null, function (items) {
        const storageDiv = document.getElementById('storageContents');

        if (!storageDiv) {
            console.error('Storage div not found');
            return;
        }

        storageDiv.innerHTML = "<h3>Storage Contents:</h3>";

        if (Object.keys(items).length === 0) {
            storageDiv.innerHTML += "<p>Storage is empty.</p>";
        } else {
            const ul = document.createElement('ul');  

            for (const key in items) {
                if (items.hasOwnProperty(key)) {
                    // Create a list item for each key
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${key}</strong>:`;

                    // Create a preformatted block to display JSON data neatly
                    const pre = document.createElement('pre');
                    pre.style.backgroundColor = "#f4f4f4"; // Light background for clarity
                    pre.style.padding = "10px";            // Padding for readability
                    pre.style.borderRadius = "5px";        // Rounded corners
                    pre.style.overflowX = "auto";          // Allow horizontal scrolling if needed
                    pre.innerText = JSON.stringify(items[key], null, 2); // Format the object for readability

                    li.appendChild(pre); // Append the formatted JSON to the list item
                    ul.appendChild(li);  // Append the list item to the list
                }
            }

            storageDiv.appendChild(ul); // Append the full list to the storageDiv
        }
    });
}

// Automatically log storage contents when the page is loaded
window.onload = function() {
    logStorageContents();
};