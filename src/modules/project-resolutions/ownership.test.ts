import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeIndirectOwnerships, passesVotingGate, qualifiesForPassiveTest } from "./ownership.js";
import type { GroupCompany } from "./project-resolution.types.js";

function company(overrides: Partial<GroupCompany> & { cvr: string; level: number }): GroupCompany {
    return {
        name: `Selskab ${overrides.cvr}`,
        parent: null,
        corporateFormCode: 60,
        votingRightsFrom: null,
        votingRightsTo: null,
        directOwnership: null,
        consolidate: false,
        ...overrides,
    };
}

describe("computeIndirectOwnerships", () => {
    it("uses the direct ownership as-is for the ultimate parent (level 0)", () => {
        const group = [company({ cvr: "00000001", level: 0, directOwnership: 1 })];
        assert.deepEqual(computeIndirectOwnerships(group), [1]);
    });

    it("skips level-0 ancestors: a level-1 company keeps its own direct ownership", () => {
        const group = [
            company({ cvr: "00000001", level: 0, directOwnership: 1 }),
            company({
                cvr: "00000002",
                level: 1,
                directOwnership: 0.6,
                parent: { name: "P", cvr: "00000001" },
            }),
        ];
        assert.deepEqual(computeIndirectOwnerships(group), [1, 0.6]);
    });

    it("multiplies direct ownership up the chain of intermediate (level > 0) owners", () => {
        const group = [
            company({ cvr: "00000001", level: 0, directOwnership: 1 }),
            company({ cvr: "00000002", level: 1, directOwnership: 0.8, parent: { name: "A", cvr: "00000001" } }),
            company({ cvr: "00000003", level: 2, directOwnership: 0.5, parent: { name: "B", cvr: "00000002" } }),
            company({ cvr: "00000004", level: 3, directOwnership: 0.25, parent: { name: "C", cvr: "00000003" } }),
        ];
        const result = computeIndirectOwnerships(group);
        assert.equal(result[2], 0.5 * 0.8);
        assert.equal(result[3], 0.25 * 0.5 * 0.8);
    });

    it("returns null when an intermediate ancestor's direct ownership is unknown", () => {
        const group = [
            company({ cvr: "00000001", level: 0, directOwnership: 1 }),
            company({ cvr: "00000002", level: 1, directOwnership: null, parent: { name: "A", cvr: "00000001" } }),
            company({ cvr: "00000003", level: 2, directOwnership: 0.5, parent: { name: "B", cvr: "00000002" } }),
        ];
        assert.equal(computeIndirectOwnerships(group)[2], null);
    });

    it("keeps null for a level-1 company with blank ownership (no multiplication happens)", () => {
        const group = [
            company({ cvr: "00000001", level: 0, directOwnership: 1 }),
            company({ cvr: "00000002", level: 1, directOwnership: null, parent: { name: "A", cvr: "00000001" } }),
        ];
        assert.equal(computeIndirectOwnerships(group)[1], null);
    });

    it("mirrors the wizard's JS coercion: blank ownership multiplied by a known ancestor gives 0", () => {
        // In the wizard, `null * 0.8 === 0`. Kept for parity.
        const group = [
            company({ cvr: "00000001", level: 0, directOwnership: 1 }),
            company({ cvr: "00000002", level: 1, directOwnership: 0.8, parent: { name: "A", cvr: "00000001" } }),
            company({ cvr: "00000003", level: 2, directOwnership: null, parent: { name: "B", cvr: "00000002" } }),
        ];
        assert.equal(computeIndirectOwnerships(group)[2], 0);
    });

    it("stops the walk when a parent CVR is not part of the group", () => {
        const group = [
            company({ cvr: "00000002", level: 1, directOwnership: 0.4, parent: { name: "X", cvr: "99999999" } }),
        ];
        assert.equal(computeIndirectOwnerships(group)[0], 0.4);
    });
});

describe("qualifiesForPassiveTest", () => {
    it("always includes the ultimate parent", () => {
        assert.equal(qualifiesForPassiveTest(1, null, 0.5), true);
    });

    it("includes subsidiaries at or above the threshold (inclusive)", () => {
        assert.equal(qualifiesForPassiveTest(2, 0.5, 0.5), true);
        assert.equal(qualifiesForPassiveTest(2, 0.4999, 0.5), false);
    });

    it("excludes subsidiaries with unknown indirect ownership", () => {
        assert.equal(qualifiesForPassiveTest(2, null, 0.5), false);
    });
});

describe("passesVotingGate", () => {
    it("always includes the ultimate parent", () => {
        assert.equal(passesVotingGate(1, null, 0.5), true);
    });

    it("treats a missing voting-rights interval as 0", () => {
        assert.equal(passesVotingGate(2, null, 0.05), false);
        assert.equal(passesVotingGate(2, null, 0), true);
    });

    it("compares the lower interval bound against the minimum (inclusive)", () => {
        assert.equal(passesVotingGate(2, 0.5, 0.5), true);
        assert.equal(passesVotingGate(2, 0.33, 0.5), false);
    });
});
