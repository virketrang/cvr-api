import { z } from "@hono/zod-openapi";

export const paramSchema = z.object({
    cvrNumber: z.coerce
        .string({
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "CVR-nummeret må ikke være tomt." };
                }
                return { message: "CVR-nummeret skal være en streng." };
            },
        })
        .regex(/^\d{8}$/, {
            error: (issue) => {
                return { message: `CVR-nummeret skal bestå af præcis 8 cifre. Du angav ${issue.input}` };
            },
        })
        .openapi({
            description: "CVR-nummeret for det selskab, der skal slås op.",
            example: "18351331",
            param: {
                in: "path",
                name: "cvrNumber",
                required: true,
            },
        }),
});

export const responseSchema = z
    .object({
        cvr: z.number().openapi({ example: 18351331 }),
        name: z.string().openapi({
            description: "The company's current registered name",
            example: "EUROPEAN ENERGY A/S",
        }),
        status: z.string().nullable().openapi({
            description: "The registry's composite status text",
            example: "NORMAL",
        }),
        active: z.boolean().openapi({
            description: "False when the registry status says the company is dissolved, deleted or ceased",
            example: true,
        }),
    })
    .openapi("CompanySummary");
