// Static checks on the extension package itself: the manifest is valid
// MV3, every file it points at exists, every page's scripts resolve, and
// the dead storage key is gone for good. Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

test("manifest is MV3, points at real files, and asks for minimal permissions", () => {
    const manifest = readJson("manifest.json");
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.name, "Chrome Screentime");
    assert.ok(fs.existsSync(path.join(root, manifest.background.service_worker)));
    assert.ok(fs.existsSync(path.join(root, manifest.action.default_popup)));
    assert.ok(fs.existsSync(path.join(root, manifest.action.default_icon)));
    assert.deepEqual([...manifest.permissions].sort(), ["storage", "tabs", "windows"]);
    assert.equal(manifest.version, readJson("package.json").version);
});

test("every script and stylesheet referenced by a page exists", () => {
    for (const page of ["pi-chart.html", "localhostTab.html"]) {
        const html = fs.readFileSync(path.join(root, page), "utf8");
        for (const match of html.matchAll(/(?:src|href)="([^":]+)"/g)) {
            assert.ok(fs.existsSync(path.join(root, match[1])), `${page} references missing file: ${match[1]}`);
        }
    }
});

test("every JavaScript file parses", () => {
    const files = ["background.js", "calendar.js", "categories.js", "dictionary.js", "pieChart.js", "popup.js"];
    for (const file of files) {
        const result = spawnSync("node", ["--check", path.join(root, file)], { encoding: "utf8" });
        assert.equal(result.status, 0, `${file} failed node --check: ${result.stderr}`);
    }
    const generator = spawnSync("node", ["--check", path.join(root, "scripts", "generate-categories.js")], { encoding: "utf8" });
    assert.equal(generator.status, 0, generator.stderr);
});

test("no code reads the dead tabFocusEvents key anymore", () => {
    for (const file of fs.readdirSync(root).filter((f) => f.endsWith(".js") || f.endsWith(".html"))) {
        const content = fs.readFileSync(path.join(root, file), "utf8");
        assert.ok(
            !content.includes('get("tabFocusEvents"'),
            `${file} still reads tabFocusEvents`,
        );
    }
});

test("no TODOs, FIXMEs, or placeholder text ship in the extension", () => {
    const banned = ["TODO", "FIXME", "Lorem ipsum", "Link Text"];
    const check = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            // lib/ is vendored third-party code; tests/ names the banned
            // words itself in the list above, so neither is scanned.
            if (entry.name === ".git" || entry.name === "lib" || entry.name === "tests") continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) check(full);
            else if (/\.(js|html|json|md|csv)$/.test(entry.name)) {
                const content = fs.readFileSync(full, "utf8");
                for (const word of banned) {
                    assert.ok(!content.includes(word), `${full} contains ${word}`);
                }
            }
        }
    };
    check(root);
});
