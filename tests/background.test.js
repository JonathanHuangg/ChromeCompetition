// End-to-end tests for background.js, the service worker that records
// browsing sessions. background.js runs against a mocked `chrome` API in a
// vm context, with a controllable clock, so timings are exact instead of
// sleep-based. Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The debounced listeners wait 100 ms before running; the tests wait a
// little longer after each simulated event so every handler has settled.
const SETTLE_MS = 250;

function loadBackground(shared, startTime) {
    // `shared` lets a test simulate a worker restart: a second load with
    // the same storage and tabs, as if the service worker had been stopped
    // and started again.
    const store = shared ? shared.store : {};
    const tabs = shared ? shared.tabs : new Map();
    let now = startTime !== undefined ? startTime : Date.UTC(2026, 10, 9, 12, 0, 0);
    const listeners = { activated: [], updated: [], focus: [], removed: [] };

    const storageGet = (key) => {
        if (typeof key === "string") return Promise.resolve({ [key]: store[key] });
        return Promise.resolve({ ...store });
    };

    const chrome = {
        storage: {
            local: {
                get(key, callback) {
                    const result = storageGet(key);
                    if (typeof callback === "function") result.then(callback);
                    return result;
                },
                set(items) {
                    Object.assign(store, items);
                    return Promise.resolve();
                },
            },
        },
        tabs: {
            get(tabId) {
                const tab = tabs.get(tabId);
                return tab ? Promise.resolve(tab) : Promise.reject(new Error("No tab"));
            },
            query({ windowId }) {
                const found = [...tabs.values()].filter(
                    (tab) => tab.windowId === windowId,
                );
                // The mock only tracks one active tab per window.
                return Promise.resolve(found.slice(0, 1));
            },
            onActivated: { addListener: (fn) => listeners.activated.push(fn) },
            onUpdated: { addListener: (fn) => listeners.updated.push(fn) },
        },
        windows: {
            WINDOW_ID_NONE: -1,
            getAll() {
                const ids = [...new Set([...tabs.values()].map((tab) => tab.windowId))];
                return Promise.resolve(ids.map((id) => ({ id, focused: false })));
            },
            onFocusChanged: { addListener: (fn) => listeners.focus.push(fn) },
            onRemoved: { addListener: (fn) => listeners.removed.push(fn) },
        },
        runtime: { getURL: (file) => `chrome-extension://test/${file}` },
    };

    const context = vm.createContext({
        chrome,
        console,
        setTimeout,
        clearTimeout,
        URL,
        // Controllable clock: background.js only ever reads Date.now().
        Date: { now: () => now },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8"), context);

    const fire = async (kind, ...args) => {
        for (const fn of listeners[kind]) fn(...args);
        await sleep(SETTLE_MS);
    };
    const getDictionary = async () => {
        const result = await storageGet("dictionary");
        // Deep-clone out of the vm realm so deepStrictEqual sees plain
        // Node objects instead of vm-context arrays.
        return JSON.parse(JSON.stringify(result.dictionary || {}));
    };

    return {
        get now() {
            return now;
        },
        advance(ms) {
            now += ms;
        },
        addTab(tab) {
            tabs.set(tab.id, tab);
        },
        fire,
        getDictionary,
        // Shared storage and tabs, so a test can load a second background
        // against the same state to simulate a worker restart.
        shared: { store, tabs },
        // The background's own guard, reached into the vm context so the
        // test can assert it agrees with dictionary.js.
        isTrackableUrl: (url) => vm.runInContext(`isTrackableUrl(${JSON.stringify(url)})`, context),
    };
}

test("switching tabs in the same window closes the previous tab's session", async () => {
    const bg = loadBackground();
    bg.addTab({ id: 1, url: "https://github.com/jon", windowId: 1 });
    bg.addTab({ id: 2, url: "https://news.ycombinator.com/", windowId: 1 });

    await bg.fire("activated", { tabId: 1, windowId: 1 });
    bg.advance(5 * 60 * 1000); // five minutes on GitHub
    await bg.fire("activated", { tabId: 2, windowId: 1 });

    const dictionary = await bg.getDictionary();
    assert.deepEqual(
        dictionary["https://github.com/jon"][1].map((e) => e.event),
        ["OPEN", "CLOSE"],
    );
    assert.equal(dictionary["https://github.com/jon"][0], 5 * 60 * 1000);
    assert.deepEqual(
        dictionary["https://news.ycombinator.com/"][1].map((e) => e.event),
        ["OPEN"],
    );
});

test("a blank tab neither opens a session nor closes the open one", async () => {
    const bg = loadBackground();
    bg.addTab({ id: 1, url: "https://github.com/jon", windowId: 1 });
    bg.addTab({ id: 2, url: "https://news.ycombinator.com/", windowId: 1 });
    bg.addTab({ id: 3, url: "about:blank", windowId: 1 });

    await bg.fire("activated", { tabId: 1, windowId: 1 });
    bg.advance(5 * 60 * 1000);
    // New blank tab: the navigation that follows will report the real URL,
    // so this activation must not end GitHub's session.
    await bg.fire("activated", { tabId: 3, windowId: 1 });
    bg.advance(2 * 60 * 1000);
    await bg.fire("activated", { tabId: 2, windowId: 1 });

    const dictionary = await bg.getDictionary();
    assert.equal(dictionary["about:blank"], undefined);
    assert.equal(dictionary["https://github.com/jon"][0], 7 * 60 * 1000);
});

test("a blank navigation followed by a real one records the real one", async () => {
    const bg = loadBackground();
    bg.addTab({ id: 1, url: "https://github.com/jon", windowId: 1 });

    // A new tab reports about:blank and then the real URL within
    // milliseconds; the first must not swallow the second.
    await bg.fire("updated", 1, { url: "about:blank" }, { url: "about:blank", status: "loading" });
    bg.advance(60 * 1000);
    await bg.fire("updated", 1, { url: "https://github.com/jon" }, { url: "https://github.com/jon", status: "loading" });

    const dictionary = await bg.getDictionary();
    assert.equal(dictionary["about:blank"], undefined);
    assert.deepEqual(
        dictionary["https://github.com/jon"][1].map((e) => e.event),
        ["OPEN"],
    );
});

test("switching to a chrome:// page ends the session and records nothing for it", async () => {
    const bg = loadBackground();
    bg.addTab({ id: 1, url: "https://github.com/jon", windowId: 1 });
    bg.addTab({ id: 3, url: "chrome://extensions/", windowId: 1 });

    await bg.fire("activated", { tabId: 1, windowId: 1 });
    bg.advance(60 * 1000);
    await bg.fire("activated", { tabId: 3, windowId: 1 });

    const dictionary = await bg.getDictionary();
    assert.equal(dictionary["chrome://extensions/"], undefined);
    assert.deepEqual(
        dictionary["https://github.com/jon"][1].map((e) => e.event),
        ["OPEN", "CLOSE"],
    );
    assert.equal(dictionary["https://github.com/jon"][0], 60 * 1000);
});

test("navigating to a new URL closes the previous page's session", async () => {
    const bg = loadBackground();
    bg.addTab({ id: 1, url: "https://github.com/jon", windowId: 1 });

    await bg.fire("activated", { tabId: 1, windowId: 1 });
    bg.advance(2 * 60 * 1000);
    bg.addTab({ id: 1, url: "https://github.com/other", windowId: 1 });
    // The URL change arrives while the tab is still loading; the old code
    // waited for status "complete" in the same event and never fired.
    await bg.fire("updated", 1, { url: "https://github.com/other" }, { url: "https://github.com/other", status: "loading" });

    const dictionary = await bg.getDictionary();
    assert.equal(dictionary["https://github.com/jon"][0], 2 * 60 * 1000);
    assert.deepEqual(
        dictionary["https://github.com/other"][1].map((e) => e.event),
        ["OPEN"],
    );
});

test("changing window focus closes the old window and opens the new one", async () => {
    const bg = loadBackground();
    bg.addTab({ id: 1, url: "https://github.com/jon", windowId: 1 });
    bg.addTab({ id: 2, url: "https://www.youtube.com/watch?v=x", windowId: 2 });

    // Window 1 gains focus at startup, opening a session for its active tab.
    // (Focusing a window does not re-fire onActivated for the already-active
    // tab, so no activation event follows.)
    await bg.fire("focus", 1);
    bg.advance(10 * 60 * 1000);
    await bg.fire("focus", 2);

    let dictionary = await bg.getDictionary();
    assert.deepEqual(
        dictionary["https://github.com/jon"][1].map((e) => e.event),
        ["OPEN", "CLOSE"],
    );
    assert.equal(dictionary["https://github.com/jon"][0], 10 * 60 * 1000);
    assert.deepEqual(
        dictionary["https://www.youtube.com/watch?v=x"][1].map((e) => e.event),
        ["OPEN"],
    );

    // Focus back: YouTube closes, GitHub opens a second session.
    bg.advance(3 * 60 * 1000);
    await bg.fire("focus", 1);
    dictionary = await bg.getDictionary();
    assert.equal(dictionary["https://www.youtube.com/watch?v=x"][0], 3 * 60 * 1000);
    assert.equal(dictionary["https://github.com/jon"][1].length, 3); // OPEN, CLOSE, OPEN
});

test("closing a window records its time, and closing it again is a no-op", async () => {
    const bg = loadBackground();
    bg.addTab({ id: 1, url: "https://github.com/jon", windowId: 1 });

    await bg.fire("activated", { tabId: 1, windowId: 1 });
    bg.advance(4 * 60 * 1000);
    await bg.fire("removed", 1);
    await bg.fire("removed", 1); // must not throw or double-count

    const dictionary = await bg.getDictionary();
    assert.equal(dictionary["https://github.com/jon"][0], 4 * 60 * 1000);
    assert.deepEqual(
        dictionary["https://github.com/jon"][1].map((e) => e.event),
        ["OPEN", "CLOSE"],
    );
});

test("a worker restart restores the open session instead of losing it", async () => {
    const first = loadBackground();
    first.addTab({ id: 1, url: "https://github.com/jon", windowId: 1 });
    first.addTab({ id: 2, url: "https://news.ycombinator.com/", windowId: 1 });

    await first.fire("activated", { tabId: 1, windowId: 1 });
    first.advance(5 * 60 * 1000); // five minutes on GitHub, then the worker restarts

    // Same storage and tabs, new worker instance, clock continued.
    const second = loadBackground(first.shared, first.now);
    await sleep(100); // let the startup restore finish
    await second.fire("activated", { tabId: 2, windowId: 1 });

    const dictionary = await second.getDictionary();
    assert.deepEqual(
        dictionary["https://github.com/jon"][1].map((e) => e.event),
        ["OPEN", "CLOSE"],
    );
    assert.equal(dictionary["https://github.com/jon"][0], 5 * 60 * 1000);
});

test("a restart closes sessions for windows that no longer exist, recording no time", async () => {
    const openedAt = Date.UTC(2026, 10, 9, 12, 0, 0);
    const openEvent = {
        url: "https://github.com/jon",
        domain: "github.com",
        timestamp: openedAt,
        event: "OPEN",
        windowID: 99,
    };
    // Window 99 is gone; the tabs map (and so getAll) only knows window 1.
    const shared = {
        store: {
            dictionary: { "https://github.com/jon": [0, [openEvent]] },
            openSessions: { 99: openEvent },
        },
        tabs: new Map([[1, { id: 1, url: "https://example.com/", windowId: 1 }]]),
    };
    const bg = loadBackground(shared, openedAt);
    await sleep(150); // let the startup restore finish

    const dictionary = await bg.getDictionary();
    // Closed where it started: the opening was observed, the stay was not,
    // so no elapsed time is invented for it.
    assert.deepEqual(
        dictionary["https://github.com/jon"][1].map((e) => [e.event, e.timestamp]),
        [
            ["OPEN", openedAt],
            ["CLOSE", openedAt],
        ],
    );
    assert.equal(dictionary["https://github.com/jon"][0], 0);
    // (Compared through JSON: the value was written by the vm context, so
    // its objects live in that realm and deepStrictEqual rejects them.)
    assert.deepEqual(JSON.parse(JSON.stringify(bg.shared.store.openSessions)), {});
});

test("the background's URL guard agrees with dictionary.js", () => {
    const bg = loadBackground();
    const Screentime = require("../dictionary");
    const urls = [
        "https://github.com/",
        "http://example.com/",
        "chrome://extensions/",
        "about:blank",
        "chrome-extension://abc/localhostTab.html",
        "not a url",
    ];
    for (const url of urls) {
        assert.equal(bg.isTrackableUrl(url), Screentime.isTrackableUrl(url), url);
    }
});
