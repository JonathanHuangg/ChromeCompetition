// Shared helpers for reading the tracking data that background.js writes.
//
// background.js stores one key in chrome.storage.local:
//
//   dictionary: { url: [totalMs, [TimeObject, ...]] }
//
// where each TimeObject is { url, domain, timestamp, event: "OPEN"|"CLOSE", windowID }
// and totalMs is the time accumulated from fully closed OPEN/CLOSE pairs.
// The dashboard (calendar.js, pieChart.js) and the popup (popup.js) all read
// through here, so the storage format has exactly one reader.
//
// Everything in this file is pure: no chrome.* calls, no DOM. The only
// inputs are the stored dictionary and timestamps, which is what makes it
// unit-testable in plain Node (see tests/dictionary.test.js).

const Screentime = (function () {
    // A URL is only worth tracking if it is a real web page. Browser pages
    // (chrome://, about:, edge://), the extension's own pages and blank tabs
    // have no meaningful domain and would pollute every chart.
    function isTrackableUrl(url) {
        if (typeof url !== "string") return false;
        try {
            const protocol = new URL(url).protocol;
            return protocol === "http:" || protocol === "https:";
        } catch {
            return false;
        }
    }

    function domainOf(url) {
        try {
            return new URL(url).hostname || null;
        } catch {
            return null;
        }
    }

    // Local midnight for the day containing `nowMs`. Sessions are filtered
    // against this so the dashboard only ever shows today.
    function todayStartMs(nowMs) {
        const day = new Date(nowMs);
        day.setHours(0, 0, 0, 0);
        return day.getTime();
    }

    // Turn the stored dictionary into one session per OPEN/CLOSE pair for the
    // given day: { url, domain, start, end }. A session still in progress
    // has end === null; callers that need a number should treat it as open
    // until `nowMs` (see totalsByDomain). Sessions are clipped to the day so
    // a tab left open overnight does not leak yesterday's time into today.
    function sessionsFromDictionary(dictionary, dayStartMs, nowMs) {
        const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
        const sessions = [];
        if (!dictionary || typeof dictionary !== "object") return sessions;

        for (const url of Object.keys(dictionary)) {
            const entry = dictionary[url];
            if (!entry || !Array.isArray(entry[1])) continue;
            let open = null;
            for (const event of entry[1]) {
                if (!event || typeof event.timestamp !== "number") continue;
                if (event.event === "OPEN") {
                    // A second OPEN without a CLOSE means the previous session
                    // was never closed (tab closed without the listener
                    // firing). End it where the new one starts instead of
                    // dropping it.
                    if (open !== null) {
                        sessions.push({ url, domain: domainOf(url), start: open, end: event.timestamp });
                    }
                    open = event.timestamp;
                } else if (event.event === "CLOSE" && open !== null) {
                    sessions.push({ url, domain: domainOf(url), start: open, end: event.timestamp });
                    open = null;
                }
            }
            if (open !== null) {
                sessions.push({ url, domain: domainOf(url), start: open, end: null });
            }
        }

        return sessions
            .filter((s) => {
                const end = s.end === null ? nowMs : s.end;
                return end > dayStartMs && s.start < dayEndMs;
            })
            .map((s) => ({
                url: s.url,
                domain: s.domain,
                start: Math.max(s.start, dayStartMs),
                end: s.end === null ? null : Math.min(s.end, dayEndMs),
            }))
            .sort((a, b) => a.start - b.start);
    }

    // Seconds per domain. Open sessions count up to `nowMs`, so the popup
    // total moves while a tab is active instead of freezing until it closes.
    function totalsByDomain(sessions, nowMs) {
        const totals = {};
        for (const session of sessions) {
            if (!session.domain) continue;
            const end = session.end === null ? nowMs : session.end;
            const seconds = Math.max(0, (end - session.start) / 1000);
            totals[session.domain] = (totals[session.domain] || 0) + seconds;
        }
        return totals;
    }

    // Seconds per category. Domains the CSV does not know fall under Other
    // rather than disappearing from the chart.
    function totalsByCategory(domainTotals, categoryByDomain) {
        const totals = {};
        for (const domain of Object.keys(domainTotals)) {
            const category = (categoryByDomain && categoryByDomain[domain]) || "Other";
            totals[category] = (totals[category] || 0) + domainTotals[domain];
        }
        return totals;
    }

    // "1h 23m", "45m", "32s", "0s". Hours only appear when they are nonzero.
    function formatDuration(totalSeconds) {
        const seconds = Math.max(0, Math.round(totalSeconds));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainder = seconds % 60;
        if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        if (minutes > 0) return `${minutes}m`;
        return `${remainder}s`;
    }

    return {
        isTrackableUrl,
        domainOf,
        todayStartMs,
        sessionsFromDictionary,
        totalsByDomain,
        totalsByCategory,
        formatDuration,
    };
})();

// Plain <script> include in the extension pages; CommonJS export for tests.
if (typeof module !== "undefined" && module.exports) {
    module.exports = Screentime;
}
