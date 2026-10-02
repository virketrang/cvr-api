/**
 * Generates src/modules/annual-reports/ifrs-concepts.json: label, balance and
 * period type for every IFRS concept the mapping in annual-report.taxonomy.ifrs.ts
 * names, read from the official taxonomy files. Fails loudly on a concept that
 * no schema defines, so a typo in the mapping can never reach production.
 *
 * Usage:
 *   npx tsx scripts/build-ifrs-concepts.ts <ifrs-full-cor.xsd>... --dk <ifrs-dk-cor.xsd> --labels <lab_ifrs-dk-da.xml>...
 *
 * Sources (see docs/research/README.md):
 *   - ifrs-full core schemas: https://xbrl.ifrs.org/taxonomy/<date>/full_ifrs/full_ifrs-cor_<date>.xsd
 *     (2014-03-05 for IFRS-DK, the newest for ESEF; pass several, the first
 *     definition of a name wins)
 *   - IFRS-DK package from Yeti: <package>/ifrs/ifrs-dk-cor_<date>.xsd and
 *     <package>/labels/lab_ifrs-dk-da_<date>.xml (Danish labels for both
 *     ifrs-dk and ifrs-full concepts)
 *   - a newer ESEF package's esef_cor-lab-da.xml for concepts added after 2014
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/modules/annual-reports/ifrs-concepts.json");

type Meta = { balance?: "debit" | "credit"; periodType?: "instant" | "duration"; label: string };

function parseElements(xsd: string): Map<string, Omit<Meta, "label">> {
    const out = new Map<string, Omit<Meta, "label">>();
    for (const match of xsd.matchAll(/<xsd:element ([^>]*)>/g)) {
        const attributes = match[1];
        if (attributes.includes('abstract="true"')) continue;
        const name = /name="([^"]+)"/.exec(attributes)?.[1];
        if (!name || out.has(name)) continue;
        const balance = /xbrli:balance="(debit|credit)"/.exec(attributes)?.[1] as Meta["balance"];
        const periodType = /xbrli:periodType="(instant|duration)"/.exec(attributes)?.[1] as Meta["periodType"];
        out.set(name, { ...(balance ? { balance } : {}), ...(periodType ? { periodType } : {}) });
    }
    return out;
}

function parseLabels(xml: string): Map<string, string> {
    const out = new Map<string, string>();
    // Standard labels only (role/label), Danish. Attribute order differs between
    // publishers, so match the whole start tag and inspect it.
    for (const match of xml.matchAll(/<link:label ([^>]*)>([^<]*)<\/link:label>/g)) {
        const attributes = match[1];
        if (!/xml:lang="da"/.test(attributes) || !/xlink:role="http:\/\/www\.xbrl\.org\/2003\/role\/label"/.test(attributes)) continue;
        const id = /xlink:label="([^"]+)"/.exec(attributes)?.[1];
        if (!id) continue;
        // "label_Assets" (IFRS-DK) or "ifrs-full_Assets_lbl"/"label_ifrs-full_Assets" (ESEF)
        const name = id.replace(/^label_/, "").replace(/^ifrs-full_/, "").replace(/_lbl$/, "").replace(/^ifrs-full_/, "");
        if (!out.has(name)) out.set(name, match[2].trim());
    }
    return out;
}

const args = process.argv.slice(2);
const fullSchemas: string[] = [];
const dkSchemas: string[] = [];
const labelFiles: string[] = [];
let bucket: string[] = fullSchemas;
for (const arg of args) {
    if (arg === "--dk") bucket = dkSchemas;
    else if (arg === "--labels") bucket = labelFiles;
    else bucket.push(arg);
}
if (fullSchemas.length === 0 || dkSchemas.length === 0 || labelFiles.length === 0) {
    console.error("usage: build-ifrs-concepts.ts <full_ifrs-cor.xsd>... --dk <ifrs-dk-cor.xsd>... --labels <lab-da.xml>...");
    process.exit(2);
}

const elements = { "ifrs-full": new Map<string, Omit<Meta, "label">>(), "ifrs-dk": new Map<string, Omit<Meta, "label">>() };
for (const file of fullSchemas) for (const [k, v] of parseElements(readFileSync(file, "utf8"))) if (!elements["ifrs-full"].has(k)) elements["ifrs-full"].set(k, v);
for (const file of dkSchemas) for (const [k, v] of parseElements(readFileSync(file, "utf8"))) if (!elements["ifrs-dk"].has(k)) elements["ifrs-dk"].set(k, v);
const labels = new Map<string, string>();
for (const file of labelFiles) for (const [k, v] of parseLabels(readFileSync(file, "utf8"))) if (!labels.has(k)) labels.set(k, v);

// The mapping is the source of truth for WHICH concepts are needed. It imports the
// JSON this script writes, so read it as text and pull the quoted qnames out.
const mappingSource = readFileSync(resolve(dirname(OUTPUT), "annual-report.taxonomy.ifrs.ts"), "utf8");
const qnames = [...new Set([...mappingSource.matchAll(/"((?:ifrs-full|ifrs-dk):[A-Za-z0-9]+)"/g)].map((m) => m[1]))].sort();

const output: Record<string, Meta> = {};
const missing: string[] = [];
const unlabelled: string[] = [];
for (const qname of qnames) {
    const [namespace, name] = qname.split(":") as ["ifrs-full" | "ifrs-dk", string];
    const meta = elements[namespace].get(name);
    if (!meta) {
        missing.push(qname);
        continue;
    }
    const label = labels.get(name);
    if (!label) unlabelled.push(qname);
    output[qname] = { label: label ?? name, ...meta };
}
// gsd concepts are ÅRL's own; label them here so the mapping can reuse them.
output["gsd:ReportingPeriodStartDate"] = { label: "Regnskabsperiodens startdato", periodType: "duration" };
output["gsd:ReportingPeriodEndDate"] = { label: "Regnskabsperiodens slutdato", periodType: "duration" };

// Balance-sheet fields must map to instant concepts and income-statement fields to
// duration concepts; a cash-flow or movement line would otherwise pass as a balance.
const sectionOf = (name: string) => new RegExp(`${name}: \\{([\\s\\S]*?)\\n    \\},`).exec(mappingSource)?.[1];
const periodMismatches: string[] = [];
for (const [section, expected] of [["balanceSheet", "instant"], ["incomeStatement", "duration"]] as const) {
    const body = sectionOf(section) ?? "";
    for (const [, key, list] of body.matchAll(/(\w+): \[([^\]]+)\]/g)) {
        for (const [, qname] of list.matchAll(/"([^"]+)"/g)) {
            const periodType = output[qname]?.periodType;
            if (periodType && periodType !== expected) periodMismatches.push(`${section}.${key}: ${qname} is ${periodType}`);
        }
    }
}
if (periodMismatches.length > 0) {
    console.error("Concepts with the wrong period type for their statement:\n  " + periodMismatches.join("\n  "));
    process.exit(1);
}

if (missing.length > 0) {
    console.error("Concepts not defined in any given schema:\n  " + missing.join("\n  "));
    process.exit(1);
}
if (unlabelled.length > 0) console.warn("No Danish label (English name used):\n  " + unlabelled.join("\n  "));

writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + "\n");
console.log(`Wrote ${Object.keys(output).length} concepts to ${OUTPUT}`);
