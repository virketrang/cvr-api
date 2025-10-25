import { z } from "@hono/zod-openapi";

export const responseSchema = z
    .object({
        name: z.string().openapi({
            description: "The name of the company",
            example: "NOVO NORDISK A/S",
        }),
        cvr: z.number().openapi({
            description: "The CVR number of the company",
            example: 24256790,
        }),
        corporateForm: z
            .object({
                code: z.number().nullable().openapi({
                    description: "The code of the corporate form",
                    example: 60,
                }),
                name: z.string().nullable().openapi({
                    description: "The name of the corporate form",
                    example: "AKTIESELSKAB",
                }),
                abbreviation: z.string().nullable().openapi({
                    description: "The abbreviation of the corporate form",
                    example: "A/S",
                }),
            })
            .openapi({
                description: "Information about the company's corporate form",
            }),
        financialYear: z
            .object({
                startDate: z.string().nullable().openapi({
                    description: "Start date of the financial year",
                    example: "2024-01-01",
                }),
                endDate: z.string().nullable().openapi({
                    description: "End date of the financial year",
                    example: "2024-12-31",
                }),
            })
            .openapi({
                description: "The company's financial year period",
            }),
        dateOfIncorporation: z.string().nullable().openapi({
            description: "The date the company was incorporated",
            example: "1989-11-28",
        }),
        ownershipPercentage: z
            .object({
                interval: z
                    .object({
                        from: z.number().nullable().openapi({
                            description: "Lower bound of ownership percentage",
                            example: 50,
                        }),
                        to: z.number().nullable().openapi({
                            description: "Upper bound of ownership percentage",
                            example: 100,
                        }),
                    })
                    .openapi({
                        description: "The interval of ownership percentage",
                    }),
                accurate: z.number().nullable().openapi({
                    description: "The exact ownership percentage if known",
                    example: 75.5,
                }),
            })
            .openapi({
                description: "Information about the ownership percentage",
            }),
        // get subsidiaries() {
        //     return z.array(responseSchema).nullable().openapi({
        //         description: "List of subsidiary companies in the corporate group",
        //         example: null,
        //     });
        // },
    })
    .openapi({
        description: "Corporate group structure for a company",
    });

export const responseFlattenedSchema = z.array(
    z
        .object({
            name: z.string().openapi({
                description: "The name of the company",
                example: "NOVO NORDISK A/S",
            }),
            cvr: z.number().openapi({
                description: "The CVR number of the company",
                example: 24256790,
            }),
            corporateForm: z
                .object({
                    code: z.number().nullable().openapi({
                        description: "The code of the corporate form",
                        example: 60,
                    }),
                    name: z.string().nullable().openapi({
                        description: "The name of the corporate form",
                        example: "AKTIESELSKAB",
                    }),
                    abbreviation: z.string().nullable().openapi({
                        description: "The abbreviation of the corporate form",
                        example: "A/S",
                    }),
                })
                .openapi({
                    description: "Information about the company's corporate form",
                }),
            financialYear: z
                .object({
                    startDate: z.string().nullable().openapi({
                        description: "Start date of the financial year",
                        example: "2024-01-01",
                    }),
                    endDate: z.string().nullable().openapi({
                        description: "End date of the financial year",
                        example: "2024-12-31",
                    }),
                })
                .openapi({
                    description: "The company's financial year period",
                }),
            dateOfIncorporation: z.string().nullable().openapi({
                description: "The date the company was incorporated",
                example: "1989-11-28",
            }),
            ownershipPercentage: z
                .object({
                    interval: z
                        .object({
                            from: z.number().nullable().openapi({
                                description: "Lower bound of ownership percentage",
                                example: 50,
                            }),
                            to: z.number().nullable().openapi({
                                description: "Upper bound of ownership percentage",
                                example: 100,
                            }),
                        })
                        .openapi({
                            description: "The interval of ownership percentage",
                        }),
                    accurate: z.number().nullable().openapi({
                        description: "The exact ownership percentage if known",
                        example: 75.5,
                    }),
                })
                .openapi({
                    description: "Information about the ownership percentage",
                }),
            level: z.number().openapi({
                description: "The level of the company in the corporate group hierarchy",
                example: 0,
            }),
            parent: z
                .object({
                    name: z.string().nullable().openapi({
                        description: "The name of the parent company",
                        example: "NOVO HOLDINGS A/S",
                    }),
                    cvr: z.number().nullable().openapi({
                        description: "The CVR number of the parent company",
                        example: 24256500,
                    }),
                })
                .nullable()
                .openapi({
                    description: "Information about the parent company.",
                    example: null,
                }),
        })
        .openapi({
            description: "Corporate group structure for a company",
        })
);

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
                name: "cvrNumber",
                required: true,
            },
        }),
});
