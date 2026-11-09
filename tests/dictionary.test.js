// Tests for dictionary.js, the pure reader for the stored tracking data.
// Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const Screentime = require("../dictionary");

const DAY = Date.UTC(2026, 10, 9, 0, 0, 0); // a Monday, local midnight base
const HOUR = 60 * 60 * 1000;

function entry(events) {
    return [0, events];
}

function event(url, timestamp, kind) {
    return { url, domain: new URL(url).hostname, timestamp, event: kind, windowID: 1 };
}

test("pairs OPEN/CLOSE events into sessions and totals them", () => {
    const dictionary = {
        "https://github.com/jon": entry([
            event("https://github.com/jon", DAY + HOUR, "OPEN"),
            event("https://github.com/jon", DAY + 2 * HOUR, "CLOSE"),
        ]),
    };
    const sessions = Screentime.sessionsFromDictionary(dictionary, DAY, DAY + 3 * HOUR);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].domain, "github.com");
    assert.equal(sessions[0].start, DAY + HOUR);
    assert.equal(sessions[0].end, DAY + 2 * HOUR);
    assert.deepEqual(Screentime.totalsByDomain(sessions, DAY + 3 * HOUR), { "github.com": 3600 });
});

test("an open session counts up to now, and keeps end null", () => {
    const dictionary = {
        "https://news.ycombinator.com/": entry([
            event("https://news.ycombinator.com/", DAY + HOUR, "OPEN"),
        ]),
    };
    const sessions = Screentime.sessionsFromDictionary(dictionary, DAY, DAY + 2 * HOUR);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].end, null);
    assert.deepEqual(Screentime.totalsByDomain(sessions, DAY + 2 * HOUR), {
        "news.ycombinator.com": 3600,
    });
});

test("a second OPEN without a CLOSE ends the previous session there", () => {
    const dictionary = {
        "https://github.com/": entry([
            event("https://github.com/", DAY + HOUR, "OPEN"),
            event("https://github.com/", DAY + 2 * HOUR, "OPEN"),
            event("https://github.com/", DAY + 3 * HOUR, "CLOSE"),
        ]),
    };
    const sessions = Screentime.sessionsFromDictionary(dictionary, DAY, DAY + 4 * HOUR);
    assert.equal(sessions.length, 2);
    assert.deepEqual(
        sessions.map((s) => [s.start - DAY, s.end - DAY]),
        [
            [HOUR, 2 * HOUR],
            [2 * HOUR, 3 * HOUR],
        ],
    );
});

test("sessions are clipped to the day and yesterday is excluded", () => {
    const dictionary = {
        "https://github.com/": entry([
            // Yesterday evening, entirely before today.
            event("https://github.com/", DAY - 2 * HOUR, "OPEN"),
            event("https://github.com/", DAY - HOUR, "CLOSE"),
            // Crosses midnight into today: only the part after midnight counts.
            event("https://github.com/", DAY - HOUR, "OPEN"),
            event("https://github.com/", DAY + HOUR, "CLOSE"),
        ]),
    };
    const sessions = Screentime.sessionsFromDictionary(dictionary, DAY, DAY + 2 * HOUR);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].start, DAY);
    assert.equal(sessions[0].end, DAY + HOUR);
});

test("unknown domains fall under Other when categorizing", () => {
    const totals = Screentime.totalsByCategory(
        { "github.com": 600, "totally-unknown.example": 300 },
        { "github.com": "Productivity" },
    );
    assert.deepEqual(totals, { Productivity: 600, Other: 300 });
});

test("formatDuration", () => {
    assert.equal(Screentime.formatDuration(0), "0s");
    assert.equal(Screentime.formatDuration(45), "45s");
    assert.equal(Screentime.formatDuration(90), "1m");
    assert.equal(Screentime.formatDuration(3600), "1h");
    assert.equal(Screentime.formatDuration(5400), "1h 30m");
    assert.equal(Screentime.formatDuration(3661), "1h 1m");
});

test("isTrackableUrl only accepts http(s) pages", () => {
    assert.equal(Screentime.isTrackableUrl("https://github.com/"), true);
    assert.equal(Screentime.isTrackableUrl("http://example.com/"), true);
    assert.equal(Screentime.isTrackableUrl("chrome://extensions/"), false);
    assert.equal(Screentime.isTrackableUrl("about:blank"), false);
    assert.equal(Screentime.isTrackableUrl("chrome-extension://abc/localhostTab.html"), false);
    assert.equal(Screentime.isTrackableUrl(""), false);
    assert.equal(Screentime.isTrackableUrl(null), false);
    assert.equal(Screentime.isTrackableUrl("not a url"), false);
});
