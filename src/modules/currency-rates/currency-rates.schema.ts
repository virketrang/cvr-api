import { z } from "@hono/zod-openapi";

import { datePathParam } from "../../utils/date-param.js";

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
    date: datePathParam("date", "Datoen for den ønskede valutakurs.", "2025-06-30"),
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
