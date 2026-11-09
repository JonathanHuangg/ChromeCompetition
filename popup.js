// Popup summary: today's total and the five domains with the most time.
// The doughnut chart itself is drawn by pieChart.js, which shares this
// page and its toggle button; this file only fills in the numbers and list.

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("openDashboard").addEventListener("click", function () {
        chrome.tabs.create({ url: chrome.runtime.getURL("localhostTab.html") });
    });

    chrome.storage.local.get("dictionary", function (result) {
        const now = Date.now();
        const sessions = Screentime.sessionsFromDictionary(
            result.dictionary || {}, Screentime.todayStartMs(now), now);
        const domainTotals = Screentime.totalsByDomain(sessions, now);
        const totalSeconds = Object.values(domainTotals).reduce((sum, seconds) => sum + seconds, 0);

        document.getElementById("total").textContent = Screentime.formatDuration(totalSeconds);

        const top = Object.entries(domainTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (top.length === 0) {
            document.getElementById("empty").style.display = "block";
            document.getElementById("chart-wrap").style.display = "none";
            return;
        }

        const list = document.getElementById("top-list");
        for (const [domain, seconds] of top) {
            const item = document.createElement("li");

            const name = document.createElement("span");
            name.className = "domain";
            name.textContent = domain;

            const time = document.createElement("span");
            time.className = "time";
            time.textContent = Screentime.formatDuration(seconds);

            item.appendChild(name);
            item.appendChild(time);
            list.appendChild(item);
        }
    });
});
