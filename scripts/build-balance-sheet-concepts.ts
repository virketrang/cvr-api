/**
 * Generates src/modules/annual-reports/balance-sheet-concepts.json: every
 * concept that a standard taxonomy places in its balance sheet, with its
 * Danish label and balance side. The validation uses it to explain a balance
 * that does not add up: a tagged amount the mapping does not use can only
 * explain the gap when the taxonomy puts it in the balance sheet at all, and
 * only on the right side (debit = assets, credit = equity and liabilities).
 *
 * Usage:
 *   npx tsx scripts/build-balance-sheet-concepts.ts \
 *     --fsa <ÅRL package>/<date>/fsa ... \
 *     --ifrs-dk <IFRS-DK package>/<date> ...
 *
 * Sources (see docs/research/README.md, Yeti):
 *   - ÅRL packages: fsa/fsa.xsd, fsa/fsa-lab-da.xml and the DKGAAP balance
 *     sheet roles fsa/400bsa_pre.xml (account form) and fsa/402bsc_pre.xml
 *     (current/non-current). Pass several versions: concepts move out of the
 *     balance sheet over time, and older filings still use them.
 *   - IFRS-DK packages: ifrs/ifrs-dk-cor_<date>.xsd, the ifrs-full core schema
 *     next to the package, ifrs/labels/lab_ifrs-dk-da_<date>.xml (Danish labels
 *     for ifrs-dk and ifrs-full concepts) and the statement of financial
 *     position roles 210.00 (current/non-current) and 220.00 (order of liquidity).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/modules/annual-reports/balance-sheet-concepts.json");

type Entry = { label: string | null; balance: "debit" | "credit" };

/** "fsa_Assets" / "ifrs-full_Assets" / "ifrs-dk_NetSales" -> "fsa:Assets" etc. */
function qnameOf(id: string): string | null {
    const match = /^(fsa|ifrs-full|ifrs-dk)_(.+)$/.exec(id);
    return match ? `${match[1]}:${match[2]}` : null;
}

function filesUnder(root: string, pattern: RegExp): string[] {
    const out: string[] = [];
    for (const name of readdirSync(root)) {
        const path = join(root, name);
        if (statSync(path).isDirectory()) out.push(...filesUnder(path, pattern));
        else if (pattern.test(name)) out.push(path);
    }
    return out;
}

/** Non-abstract monetary elements with a balance attribute, by id. */
function balances(xsdPaths: string[]): Map<string, "debit" | "credit"> {
    const out = new Map<string, "debit" | "credit">();
    for (const path of xsdPaths) {
        for (const match of readFileSync(path, "utf8").matchAll(/<xsd:element ([^>]*)>/g)) {
            const attributes = match[1];
            if (attributes.includes('abstract="true"')) continue;
            const id = /\bid="([^"]+)"/.exec(attributes)?.[1];
            const balance = /xbrli:balance="(debit|credit)"/.exec(attributes)?.[1] as "debit" | "credit" | undefined;
            if (id && balance && !out.has(id)) out.set(id, balance);
        }
    }
    return out;
}

/** Element ids located in presentation files. */
function presented(prePaths: string[]): Set<string> {
    const out = new Set<string>();
    for (const path of prePaths) {
        for (const match of readFileSync(path, "utf8").matchAll(/xlink:href="[^"#]*#([^"]+)"/g)) out.add(match[1]);
    }
    return out;
}

/** Standard Danish labels by element id. */
function labels(labPaths: string[]): Map<string, string> {
    const out = new Map<string, string>();
    for (const path of labPaths) {
        const text = readFileSync(path, "utf8");
        const locs = new Map<string, string>();
        for (const match of text.matchAll(/<link:loc\b[^>]*>/g)) {
            const href = /xlink:href="[^"#]*#([^"]+)"/.exec(match[0])?.[1];
            const label = /xlink:label="([^"]+)"/.exec(match[0])?.[1];
            if (href && label) locs.set(label, href);
        }
        const resources = new Map<string, string>();
        for (const match of text.matchAll(/<link:label\b([^>]*)>([^<]*)<\/link:label>/g)) {
            if (!/xlink:role="http:\/\/www\.xbrl\.org\/2003\/role\/label"/.test(match[1])) continue;
            const label = /xlink:label="([^"]+)"/.exec(match[1])?.[1];
            if (label) resources.set(label, match[2].trim());
        }
        for (const match of text.matchAll(/<link:labelArc\b[^>]*>/g)) {
            const from = /xlink:from="([^"]+)"/.exec(match[0])?.[1];
            const to = /xlink:to="([^"]+)"/.exec(match[0])?.[1];
            const id = from ? locs.get(from) : undefined;
            const text = to ? resources.get(to) : undefined;
            if (id && text && !out.has(id)) out.set(id, text);
        }
    }
    return out;
}

const args = process.argv.slice(2);
const fsaDirs: string[] = [];
const ifrsDkDirs: string[] = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fsa") fsaDirs.push(args[++i]);
    else if (args[i] === "--ifrs-dk") ifrsDkDirs.push(args[++i]);
}
if (fsaDirs.length === 0 || ifrsDkDirs.length === 0) {
    console.error("Usage: build-balance-sheet-concepts.ts --fsa <dir>... --ifrs-dk <dir>...");
    process.exit(1);
}

const xsds: string[] = [];
const pres: string[] = [];
const labs: string[] = [];
for (const dir of fsaDirs) {
    xsds.push(join(dir, "fsa.xsd"));
    pres.push(join(dir, "400bsa_pre.xml"), join(dir, "402bsc_pre.xml"));
    labs.push(join(dir, "fsa-lab-da.xml"));
}
for (const dir of ifrsDkDirs) {
    xsds.push(...filesUnder(dir, /^ifrs-dk-cor_.*\.xsd$/), ...filesUnder(resolve(dir, ".."), /^full_ifrs-cor_.*\.xsd$/));
    pres.push(...filesUnder(dir, /^pre_ifrs-dk_.*_role-2[12]0\.00\.xml$/));
    labs.push(...filesUnder(dir, /^lab_ifrs-dk-da_.*\.xml$/));
}

const balanceOf = balances(xsds);
const labelOf = labels(labs);
const result: Record<string, Entry> = {};
for (const id of [...presented(pres)].sort()) {
    const qname = qnameOf(id);
    const balance = balanceOf.get(id);
    if (!qname || !balance) continue;
    result[qname] = { label: labelOf.get(id) ?? null, balance };
}

writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
console.log(`${Object.keys(result).length} concepts written to ${OUTPUT}`);
