import { z } from "@hono/zod-openapi";

import { parseFlexibleDate } from "../../utils/format-date.js";

export const paramSchema = z.object({
    currency: z
        .string()
        .length(3, "Valutakoden skal bestå af præcis 3 bogstaver (ISO 4217), fx EUR.")
        .openapi({
            description: "ISO 4217-valutakoden, fx EUR.",
            example: "EUR",
            param: {
                in: "path",
                name: "currency",
                required: true,
            },
        }),
    date: z
        .string()
        .transform((value, ctx) => {
            const isoDate = parseFlexibleDate(value);
            if (!isoDate) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        `Datoen "${value}" kunne ikke genkendes som en gyldig kalenderdato. ` +
                        "Understøttede formater: 2025-12-31, 31-12-2025, 20251231, 31122025 " +
                        "(også med / eller . som skilletegn) samt månedsnavne, fx '31. december 2025'.",
                });
                return z.NEVER;
            }
            return isoDate;
        })
        .openapi({
            description:
                "Datoen for den ønskede valutakurs. Accepterer ISO (2025-12-31), dansk (31-12-2025), " +
                "kompakt (20251231, 31122025), - / . som skilletegn samt danske/engelske månedsnavne " +
                "('31. december 2025'). Ved / eller mellemrum skal værdien URL-enkodes (%2F, %20).",
            example: "2025-06-30",
            param: {
                in: "path",
                name: "date",
                required: true,
            },
        }),
});

export const responseSchema = z
    .object({
        requestedDate: z.string().openapi({
            description: "Den dato der blev spurgt om (ISO yyyy-mm-dd).",
            example: "2025-06-30",
        }),
        rateDate: z.string().openapi({
            description: "Den faktiske bankdag kursen stammer fra (kan være tidligere end den ønskede dato).",
            example: "2025-06-27",
        }),
        currency: z.string().openapi({
            description: "Valutakoden.",
            example: "EUR",
        }),
        description: z.string().openapi({
            description: "Nationalbankens beskrivelse af valutaen.",
            example: "Euro",
        }),
        ratePer100: z.number().openapi({
            description: "Kursen pr. 100 enheder — som Nationalbanken noterer den.",
            example: 745.94,
        }),
        rate: z.number().openapi({
            description: "Kursen pr. 1 enhed (ratePer100 / 100).",
            example: 7.4594,
        }),
    })
    .openapi({
        description: "Valutakursen for den ønskede valuta og dato.",
    });
