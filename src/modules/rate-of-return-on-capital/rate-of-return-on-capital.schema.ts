import { z } from "@hono/zod-openapi";

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
