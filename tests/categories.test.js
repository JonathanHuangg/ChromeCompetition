// The generated categories.js must match categorized_websites.csv exactly.
// If someone edits the CSV without regenerating, or hand-edits the generated
// file, this fails. Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const { CATEGORY_BY_DOMAIN, CATEGORIES } = require("../categories.js");

function parseCsv(text) {
    const map = {};
    for (const line of text.split(/\r?\n/).slice(1)) {
        if (!line.trim()) continue;
        const comma = line.indexOf(",");
        map[line.slice(0, comma).trim()] = line.slice(comma + 1).trim();
    }
    return map;
}

test("categories.js matches categorized_websites.csv", () => {
    const fromCsv = parseCsv(fs.readFileSync(path.join(root, "categorized_websites.csv"), "utf8"));
    assert.deepEqual(CATEGORY_BY_DOMAIN, fromCsv);
});

test("categories are clean: no trailing periods, stray quotes, or blanks", () => {
    for (const [domain, category] of Object.entries(CATEGORY_BY_DOMAIN)) {
        assert.ok(domain && !domain.endsWith("."), `bad domain: ${domain}`);
        assert.ok(category && !category.endsWith(".") && !category.includes("'"), `bad category for ${domain}: ${category}`);
    }
    assert.equal(Object.keys(CATEGORY_BY_DOMAIN).length, 1000);
});

test("CATEGORIES lists every category exactly once, sorted", () => {
    const expected = [...new Set(Object.values(CATEGORY_BY_DOMAIN))].sort();
    assert.deepEqual(CATEGORIES, expected);
});
