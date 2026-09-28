import { describe, it } from "node:test";
import assert from "node:assert/strict";

import CompanyService from "./company.service.js";
import type { CompanyLookupSource } from "./company.types.js";

const source = (name: string | null, status: string | null): CompanyLookupSource => ({
    Vrvirksomhed: {
        cvrNummer: 18351331,
        virksomhedMetadata: { nyesteNavn: name === null ? null : { navn: name }, sammensatStatus: status },
    },
});

describe("CompanyService.toSummary", () => {
    it("returns the current name and marks a NORMAL company active", () => {
        assert.deepEqual(CompanyService.toSummary(source("EUROPEAN ENERGY A/S", "NORMAL")), {
            cvr: 18351331,
            name: "EUROPEAN ENERGY A/S",
            status: "NORMAL",
            active: true,
        });
    });

    it("marks dissolved, deleted and ceased companies inactive", () => {
        for (const status of ["OPLØST EFTER FUSION", "SLETTET", "TVANGSOPLØST", "Ophørt"]) {
            assert.equal(CompanyService.toSummary(source("X ApS", status))?.active, false, status);
        }
    });

    it("treats a missing status as active and a missing name as no company", () => {
        assert.equal(CompanyService.toSummary(source("X ApS", null))?.active, true);
        assert.equal(CompanyService.toSummary(source("   ", "NORMAL")), null);
        assert.equal(CompanyService.toSummary(source(null, "NORMAL")), null);
    });
});
