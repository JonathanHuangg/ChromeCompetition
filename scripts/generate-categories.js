// Generates categories.js from categorized_websites.csv.
//
// The CSV is the source of truth: it is the file a human edits when a
// domain is miscategorized. The generated file is what the extension loads,
// so the two can never drift apart the way the old hardcoded copy in
// pieChart.js did (it disagreed with the CSV on 110 rows: trailing periods
// like "Entertainment." and a stray quote in "'Government'").
//
// Usage: node scripts/generate-categories.js
// The test suite re-runs the same parse and asserts the checked-in
// categories.js matches the CSV, so a hand-edited category map fails tests.

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const csvPath = path.join(root, "categorized_websites.csv");
const outPath = path.join(root, "categories.js");

function parseCsv(text) {
    const map = {};
    const lines = text.split(/\r?\n/);
    for (const line of lines.slice(1)) {
        if (!line.trim()) continue;
        const comma = line.indexOf(",");
        const domain = line.slice(0, comma).trim();
        const category = line.slice(comma + 1).trim();
        if (!domain || !category) throw new Error(`Bad row in categorized_websites.csv: ${line}`);
        if (map[domain]) throw new Error(`Duplicate domain in categorized_websites.csv: ${domain}`);
        map[domain] = category;
    }
    return map;
}

function main() {
    const map = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const domains = Object.keys(map).sort();
    const categories = [...new Set(Object.values(map))].sort();
    const entries = domains.map((d) => `    ${JSON.stringify(d)}: ${JSON.stringify(map[d])},`).join("\n");

    const out = `// GENERATED FILE. Do not edit by hand.
//
// Built from categorized_websites.csv by scripts/generate-categories.js.
// Edit the CSV, run the generator, and commit both files together.
// ${domains.length} domains across ${categories.length} categories.
const CATEGORY_BY_DOMAIN = {
${entries}
};

const CATEGORIES = ${JSON.stringify(categories)};

if (typeof module !== "undefined" && module.exports) {
    module.exports = { CATEGORY_BY_DOMAIN, CATEGORIES };
}
`;
    fs.writeFileSync(outPath, out);
    console.log(`Wrote ${outPath}: ${domains.length} domains, ${categories.length} categories.`);
}

main();
