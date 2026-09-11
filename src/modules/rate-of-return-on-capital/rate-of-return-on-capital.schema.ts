import { z } from "@hono/zod-openapi";

import { datePathParam } from "../../utils/date-param.js";

export const responseSchema = z
    .object({
        year: z.number().openapi({
            description: "The year that the rate of return on capital applies to",
            example: 2025,
        }),
        value: z.number().nullable().openapi({
            description: "The rate of return on capital for the year",
            example: 0.04,
        }),
    })
    .openapi({
        description: "The applicable rate of return on capital",
    });

export const atDateParamSchema = z.object({
    date: datePathParam("date", "Overdragelsesdatoen (eller en anden dato) der spørges om.", "2025-03-01"),
});

export const atDateResponseSchema = z
    .object({
        requestedDate: z.string().openapi({
            description: "Den dato der blev spurgt om (ISO yyyy-mm-dd).",
            example: "2025-03-01",
        }),
        year: z.number().openapi({
            description: "Det indkomstår, den returnerede sats er offentliggjort for.",
            example: 2024,
        }),
        value: z.number().openapi({
            description: "Kapitalafkastsatsen som decimalbrøk, fx 0.04 for 4 pct.",
            example: 0.04,
        }),
        publishedAt: z.string().nullable().openapi({
            description:
                "Den dag Skattestyrelsen offentliggjorde satsen (ISO yyyy-mm-dd). null hvis satsen kun kendes fra " +
                "skm.dk's tabel, fordi API'ets register endnu ikke er opdateret med offentliggørelsesdatoen.",
            example: "2024-08-15",
        }),
        reference: z.string().nullable().openapi({
            description: "SKM-meddelelsen satsen blev offentliggjort i. null i samme tilfælde som publishedAt.",
            example: "SKM2024.399.SKTST",
        }),
        warning: z.string().nullable().openapi({
            description:
                "Dansk forbehold, når svaret ikke kunne afgøres alene ud fra registret (fx fordi der er " +
                "offentliggjort en nyere sats, som registret mangler datoen for). null når svaret er sikkert.",
            example: null,
        }),
    })
    .openapi({
        description:
            "Den kapitalafkastsats, der var den senest offentliggjorte på den angivne dato — dvs. den på " +
            "overdragelsestidspunktet gældende sats efter boafgiftslovens § 12 a.",
    });
