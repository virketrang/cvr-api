import { z } from "@hono/zod-openapi";

const percentageIntervalSchema = (subject: string) =>
    z
        .object({
            from: z.number().nullable().openapi({
                description: `Lower bound of ${subject}`,
                example: 50,
            }),
            to: z.number().nullable().openapi({
                description: `Upper bound of ${subject}`,
                example: 100,
            }),
        })
        .openapi({
            description: `The interval of ${subject}`,
        });

const percentageSchema = (subject: string) =>
    z
        .object({
            interval: percentageIntervalSchema(subject),
            accurate: z.boolean().openapi({
                description: `a boolean indicating if the ${subject} is accurate`,
                example: true,
            }),
        })
        .openapi({
            description: `Information about the ${subject}`,
        });

const corporateEventSchema = z
    .object({
        name: z.string().nullable().openapi({
            description: "The registry's name for the event",
            example: "Fusion",
        }),
        date: z.string().nullable().openapi({
            description: "The date the event took effect",
            example: "2000-01-14",
        }),
        incoming: z.boolean().openapi({
            description: "True when the company was on the receiving end (indgående)",
            example: true,
        }),
        outgoing: z.boolean().openapi({
            description: "True when the company was on the giving end (udgående)",
            example: false,
        }),
    })
    .openapi({
        description: "A merger (fusion) or demerger (spaltning) the company has taken part in",
    });

const addressSchema = z
    .object({
        street: z.string().nullable().openapi({
            description: "Street name (vejnavn)",
            example: "Lundbergsvej",
        }),
        houseNumberFrom: z.number().nullable().openapi({
            description: "House number, or the first house number of a range (husnummerFra)",
            example: 10,
        }),
        houseNumberTo: z.number().nullable().openapi({
            description: "Last house number of a range (husnummerTil)",
            example: null,
        }),
        letterFrom: z.string().nullable().openapi({
            description: "House letter, or the first letter of a range (bogstavFra)",
            example: null,
        }),
        letterTo: z.string().nullable().openapi({
            description: "Last house letter of a range (bogstavTil)",
            example: null,
        }),
        floor: z.string().nullable().openapi({
            description: "Floor (etage)",
            example: null,
        }),
        sideDoor: z.string().nullable().openapi({
            description: "Side/door (sidedør)",
            example: null,
        }),
        coName: z.string().nullable().openapi({
            description: "c/o name (conavn)",
            example: null,
        }),
        poBox: z.string().nullable().openapi({
            description: "PO box (postboks)",
            example: null,
        }),
        zipCode: z.number().nullable().openapi({
            description: "Zip code (postnummer)",
            example: 8400,
        }),
        city: z.string().nullable().openapi({
            description: "City (postdistrikt)",
            example: "Ebeltoft",
        }),
        municipality: z.string().nullable().openapi({
            description: "Municipality (kommune)",
            example: "SYDDJURS",
        }),
        countryCode: z.string().nullable().openapi({
            description: "Country code (landekode)",
            example: "DK",
        }),
        freeText: z.string().nullable().openapi({
            description: "Free-text address used when the address is not structured, e.g. foreign (fritekst)",
            example: null,
        }),
    })
    .nullable()
    .openapi({
        description: "The company's current registered address (beliggenhedsadresse)",
    });

const companySchema = z.object({
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
    ownershipPercentage: percentageSchema("ownership percentage"),
    votingRightsPercentage: percentageSchema("voting rights percentage"),
    selfOwnershipPercentage: percentageIntervalSchema("self-ownership percentage")
        .nullable()
        .optional()
        .openapi({
            description: "The company's ownership of its own shares, when registered",
        }),
    listed: z.boolean().openapi({
        description: "Whether the company is listed on a stock exchange (børsnoteret)",
        example: false,
    }),
    purpose: z.string().nullable().openapi({
        description: "The company's stated purpose (formål)",
        example: "Selskabets formål er at eje aktier i datterselskaber og anden dermed beslægtet investering.",
    }),
    hasShareClasses: z.boolean().openapi({
        description: "Whether the share capital is divided into classes (kapitalklasser)",
        example: true,
    }),
    status: z.string().nullable().openapi({
        description: "Current company status (virksomhedsstatus)",
        example: "NORMAL",
    }),
    mainIndustry: z.string().nullable().openapi({
        description: "Current main industry as 'code - text' (hovedbranche)",
        example: "642120 - Ikke-finansielle holdingselskaber",
    }),
    secondaryNames: z.array(z.string()).openapi({
        description: "Current secondary names (binavne)",
        example: ["KVADRAT INVEST A/S"],
    }),
    demergers: z.array(corporateEventSchema).openapi({
        description: "Demergers the company has taken part in (spaltninger)",
        example: [],
    }),
    mergers: z.array(corporateEventSchema).openapi({
        description: "Mergers the company has taken part in (fusioner)",
        example: [],
    }),
    address: addressSchema,
    capital: z
        .object({
            value: z.number().nullable().openapi({
                description: "The registered capital (kapital)",
                example: 100000000,
            }),
            currency: z.string().nullable().openapi({
                description: "The currency of the registered capital (kapitalvaluta)",
                example: "DKK",
            }),
        })
        .openapi({
            description: "The company's registered capital and its currency",
        }),
    firstFinancialYear: z
        .object({
            startDate: z.string().nullable().openapi({
                description: "Start date of the first financial period (første regnskabsperiode)",
                example: "1990-11-07",
            }),
            endDate: z.string().nullable().openapi({
                description: "End date of the first financial period (første regnskabsperiode)",
                example: "1991-06-30",
            }),
        })
        .openapi({
            description: "The company's first financial period",
        }),
    audited: z.boolean().openapi({
        description: "Whether the company is subject to audit — false when audit is opted out (revision fravalgt)",
        example: true,
    }),
    powerToBind: z.string().nullable().openapi({
        description: "The rule for who can sign on behalf of the company (tegningsregel)",
        example: "Selskabet tegnes af den samlede bestyrelse.",
    }),
});

export const responseSchema = companySchema
    // Note: subsidiaries (a recursive tree of this same shape) is returned but not
    // documented here, as zod-openapi cannot express the recursion cleanly.
    .openapi({
        description: "Corporate group structure for a company",
    });

export const responseFlattenedSchema = z.array(
    companySchema
        .extend({
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
        }),
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
        .regex(/^\d{8}$/, {
            error: (issue) => {
                return { message: `CVR-nummeret skal bestå af præcis 8 cifre. Du angav ${issue.input}` };
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
