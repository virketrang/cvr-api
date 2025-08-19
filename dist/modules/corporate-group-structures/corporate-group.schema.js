import { z } from "@hono/zod-openapi";
export const responseSchema = z.object({
    name: z.string(),
    cvr: z.number(),
    corporateForm: z.object({
        code: z.number().nullable(),
        name: z.string().nullable(),
        abbreviation: z.string().nullable(),
    }),
    financialYear: z.object({
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
    }),
    dateOfIncorporation: z.string().nullable(),
    ownershipPercentage: z.object({
        interval: z.object({
            from: z.number().nullable(),
            to: z.number().nullable(),
        }),
        accurate: z.number().nullable(),
    }),
    get subsidiaries() {
        return z.array(responseSchema).nullable();
    },
});
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
        .length(8, {
        error: (issue) => {
            return { message: `CVR-nummeret skal have præcis 8 cifre. Du angav ${issue.input}` };
        },
    })
        .openapi({
        description: "CVR-nummeret for det selskab, hvis koncernstruktur skal hentes.",
        example: "12345678",
        param: {
            in: "path",
            name: "cvrNummer",
            required: true,
        },
    }),
});
