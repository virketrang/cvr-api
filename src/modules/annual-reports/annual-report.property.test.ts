import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { investmentPropertyAtFairValue, plainPolicyText } from "./annual-report.property.js";

// Policy texts as they are written in real filings (shortened).
const FAIR_VALUE =
    "Investeringsejendomme måles ved første indregning til kostpris, der omfatter ejendommenes købspris. " +
    "Investeringsejendomme måles efterfølgende ejendom for ejendom til en skønnet dagsværdi.";
const COST =
    "Investeringsejendomme måles til kostpris med fradrag af akkumulerede afskrivninger og nedskrivninger. " +
    "Dagsværdien oplyses i noterne.";
const COST_ONLY = "Investeringsejendomme indregnes på erhvervelsestidspunktet til kostpris.";

describe("investmentPropertyAtFairValue", () => {
    it("reads the measurement after initial recognition, which is always at cost", () => {
        assert.equal(investmentPropertyAtFairValue({ policyText: FAIR_VALUE, fairValueAdjustmentTagged: false }), true);
        assert.equal(investmentPropertyAtFairValue({ policyText: COST, fairValueAdjustmentTagged: false }), false);
        assert.equal(investmentPropertyAtFairValue({ policyText: COST_ONLY, fairValueAdjustmentTagged: false }), false);
    });

    it("takes a tagged fair value adjustment line as fair value when the policy is silent", () => {
        assert.equal(investmentPropertyAtFairValue({ policyText: null, fairValueAdjustmentTagged: true }), true);
        assert.equal(investmentPropertyAtFairValue({ policyText: COST_ONLY, fairValueAdjustmentTagged: true }), true);
    });

    it("says nothing when the report does not tell, or contradicts itself", () => {
        assert.equal(investmentPropertyAtFairValue({ policyText: null, fairValueAdjustmentTagged: false }), null);
        assert.equal(investmentPropertyAtFairValue({ policyText: "Investeringsejendomme.", fairValueAdjustmentTagged: false }), null);
        assert.equal(investmentPropertyAtFairValue({ policyText: COST, fairValueAdjustmentTagged: true }), null);
    });

    it("reads soft hyphens, escaped markup and English policies", () => {
        const hyphenated = "&lt;p&gt;Investerings­ejendomme måles efterfølgende til dags­vær­di.&lt;/p&gt;";
        assert.equal(plainPolicyText(hyphenated), "Investeringsejendomme måles efterfølgende til dagsværdi.");
        assert.equal(investmentPropertyAtFairValue({ policyText: hyphenated, fairValueAdjustmentTagged: false }), true);
        assert.equal(
            investmentPropertyAtFairValue({ policyText: "Investment property is measured at fair value.", fairValueAdjustmentTagged: false }),
            true,
        );
    });
});
