# Chrome Screentime

A Chrome extension that shows where your browsing time actually goes: a
popup with today's total and top sites, and a full dashboard with a day
calendar and a breakdown by category or by domain.

It started as a friendly build competition — Jonathan vs. Max vs. Namkhang,
with Raghav on the sideline — to see who could build the best screen-time
tracker. This version is the one that finally works end to end: the original
tracked sessions in the background but the dashboard read from a storage key
nothing ever wrote, so both views were always empty.

## How it works

The service worker (`background.js`) listens for tab switches, navigations,
window focus changes, and window closes, and records each visit as an
OPEN/CLOSE pair in `chrome.storage.local` under one key:

```js
dictionary: { url: [totalMs, [TimeObject, ...]] }
```

The popup (`pi-chart.html`) and the dashboard (`localhostTab.html`) both
read that same key through `dictionary.js`, which turns the stored pairs
into today's sessions and totals. Categories come from
`categorized_websites.csv` (1,000 domains, 15 categories); `categories.js`
is generated from it, so the two can never drift apart again.

Everything runs locally. There is no server, no account, and no data
leaving the machine. Only `http:`/`https:` pages are tracked; browser
pages, the extension's own pages, and blank tabs are ignored.

A few things the tracking has to get right, and does:

- **Same-window tab switches close the previous tab's session.** The
  original only closed sessions for *other* windows, so switching tabs in
  one window silently dropped the time.
- **Same-tab navigation is recorded.** The original waited for the URL
  change and the load completing in the same event; Chrome reports those
  separately, so navigation was never tracked.
- **The service worker can be stopped and restarted at any time.**
  No work is deferred behind `setTimeout` (a worker can be killed before
  a timer fires), storage writes are serialized with a promise-chain lock,
  and open sessions are persisted and restored on startup. A session whose
  window is gone by restart time is closed with no elapsed time recorded
  rather than inventing any.

## Install

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** and pick this folder.
3. Browse normally. Click the extension icon for today's summary, or
   **Open full dashboard** for the calendar view.

## Categories

To fix a domain's category, edit `categorized_websites.csv` and run:

```sh
npm run generate:categories
```

Commit both files together. The test suite fails if the generated file
does not match the CSV.

## Tests

```sh
npm test
```

Zero dependencies, plain `node --test`. The suite covers the session
math, the category map, the manifest and page wiring, and the service
worker itself, driven against a mocked `chrome` API with a controllable
clock — including worker restarts. The same flow was also verified in
headless Chromium with the real extension loaded: two tabs, a navigation,
a 35-second idle stretch long enough for Chrome to stop the worker, and
the popup, dashboard, and category toggle all rendering from the
recorded data.

## Files

| File | What it does |
| --- | --- |
| `manifest.json` | MV3 manifest: `tabs`, `windows`, `storage`, nothing else |
| `background.js` | Service worker: records sessions |
| `dictionary.js` | Shared, pure reader: sessions, totals, formatting |
| `categories.js` | Generated domain-to-category map |
| `categorized_websites.csv` | Source of truth for categories |
| `calendar.js` | Dashboard day calendar (FullCalendar) |
| `pieChart.js` | Doughnut chart, categories or domains (Chart.js) |
| `popup.js`, `pi-chart.html` | Toolbar popup: total, top sites, chart |
| `localhostTab.html` | Full dashboard page |
| `lib/` | Vendored Chart.js, FullCalendar, Bootstrap |
| `scripts/generate-categories.js` | CSV-to-JS generator |
| `tests/` | `node --test` suite |

## Known limitations

- Time counts while a tab is the active one, including while you are away
  from the keyboard; there is no idle detection.
- A session that was open when the browser itself closed is closed with
  no elapsed time on the next startup (see above): the time you spent on
  it before closing is not recoverable, and guessing would be worse.
