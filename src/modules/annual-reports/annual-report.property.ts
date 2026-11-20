/**
 * Whether a report's investment property is measured at fair value (ÅRL § 38,
 * IAS 40's fair value model) or at cost. The valuation workbook needs this to
 * decide whether the property can enter the valuation at its book value
 * ("dagsværdi", boafgiftsloven § 12 a, stk. 3, nr. 1) and whether the earnings
 * already contain the fair value adjustments.
 *
 * Neither taxonomy has a field for the measurement basis, so it is read from
 * two signals in the report:
 *
 *  - the accounting policy text for investment property. Almost every policy
 *    names cost, because initial recognition is always at cost; what decides
 *    is how the property is measured afterwards, so the text counts as fair
 *    value when a measurement verb is followed by "dagsværdi" / "fair value"
 *    within the same sentence, and as cost when it describes cost less
 *    depreciation;
 *  - the income statement line for fair value adjustments of investment
 *    property, which only fair value reports tag.
 *
 * Measured on the 293 ÅRL reports with investment property among the 4,299
 * published 11-19 November 2026: 212 read as fair value, about 30 as cost, and
 * about 50 say nothing either way (null).
 */

const SOFT_HYPHEN = /­|&shy;/gi;

/** A measurement verb followed, in the same sentence, by fair value. */
const FAIR_VALUE_POLICY =
    /(m(å|aa|a)les|indregnes|opg(ø|oe)res|vurderes|optages|v(æ|ae)rdians(æ|ae)ttes|measured|carried|stated|recogni[sz]ed)[^.]{0,80}?(dagsv(æ|ae)rdi|fair value)/i;

/** Cost less depreciation, i.e. the cost model. */
const COST_POLICY =
    /kostpris med fradrag af[^.]{0,40}(afskrivning|nedskrivning)|(m(å|aa|a)les|indregnes)( efterf(ø|oe)lgende)?[^.]{0,30}til kostpris[^.]{0,30}(afskriv|nedskriv)|cost model|cost less accumulated depreciation/i;

const MENTIONS_FAIR_VALUE = /dagsv(æ|ae)rdi|fair value/i;
const MENTIONS_COST = /kostpris|at cost\b/i;

/** The policy text as plain prose: markup, entities and soft hyphens removed. */
export function plainPolicyText(raw: string): string {
    let text = raw;
    // Text blocks often arrive HTML-escaped once or twice.
    for (let i = 0; i < 2; i++) {
        text = text
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&");
    }
    return text
        .replace(SOFT_HYPHEN, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * True when the investment property is measured at fair value, false when at
 * cost, null when the report does not say. A policy that describes the cost
 * model while the fair value adjustment line is tagged is contradictory and
 * also gives null.
 */
export function investmentPropertyAtFairValue(evidence: { policyText: string | null; fairValueAdjustmentTagged: boolean }): boolean | null {
    const policy = evidence.policyText ? plainPolicyText(evidence.policyText) : "";

    if (FAIR_VALUE_POLICY.test(policy)) return true;
    if (COST_POLICY.test(policy)) return evidence.fairValueAdjustmentTagged ? null : false;
    if (evidence.fairValueAdjustmentTagged) return true;
    if (MENTIONS_COST.test(policy) && !MENTIONS_FAIR_VALUE.test(policy)) return false;
    return null;
}
