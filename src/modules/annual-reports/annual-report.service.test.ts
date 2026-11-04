import { describe, it } from "node:test";
import assert from "node:assert/strict";

import AnnualReportService from "./annual-report.service.js";

describe("AnnualReportService.priorYearMismatchMessage", () => {
    it("names each item with both amounts and the difference, largest difference first", () => {
        const message = AnnualReportService.priorYearMismatchMessage(
            [
                { statement: "incomeStatement", field: "profitLoss", label: "Årets resultat", value: 989944, valueInNextReport: 994444 },
                { statement: "consolidatedBalanceSheet", field: "assets", label: "Aktiver", value: 12500000, valueInNextReport: 12000000 },
            ],
            "2024-12-31",
        );

        assert.equal(
            message,
            "2 beløb i denne årsrapport afviger fra sammenligningstallene i den efterfølgende årsrapport " +
                "(regnskabsår slut 2024-12-31), typisk pga. en korrektion/omarbejdelse. " +
                "Denne rapport → efterfølgende rapport (afvigelse): " +
                "Aktiver (koncernbalance): 12.500.000 → 12.000.000 (-500.000); " +
                "Årets resultat (resultatopgørelse): 989.944 → 994.444 (+4.500). Kontrollér tallene.",
        );
    });

    it("lists every differing item, however many", () => {
        const differences = Array.from({ length: 12 }, (_, i) => ({
            statement: "balanceSheet" as const,
            field: `field${i}`,
            label: `Post ${i}`,
            value: 0,
            valueInNextReport: i + 1,
        }));

        const message = AnnualReportService.priorYearMismatchMessage(differences, "2024-12-31");

        assert.match(message, /^12 beløb/);
        for (let i = 0; i < 12; i++) assert.ok(message.includes(`Post ${i} (balance): 0 → ${i + 1} (+${i + 1})`));
        assert.match(message, /Post 0 \(balance\): 0 → 1 \(\+1\)\. Kontrollér tallene\.$/);
    });
});
