import { z } from "@hono/zod-openapi";

import { dateQueryParam } from "../../utils/date-param.js";
import { parseFlexibleDate } from "../../utils/format-date.js";
import { groupEntityFromNotesSchema } from "../annual-reports/annual-report.schema.js";

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
            label: z.string().nullable().optional().openapi({
                description: `Display label for the ${subject} band, e.g. "25–33,32 %" or "100 %"`,
                example: "100 %",
            }),
        })
        .openapi({
            description: `Information about the ${subject}`,
        });

const ownerSchema = z
    .object({
        cvr: z.number().nullable().openapi({ description: "CVR number for companies; null for persons and other participants", example: 78809019 }),
        name: z.string().openapi({ example: "TIKA HOLDING A/S" }),
        type: z.enum(["COMPANY", "PERSON", "OTHER"]),
        ownershipPercentage: percentageSchema("ownership percentage"),
        votingRightsPercentage: percentageSchema("voting rights percentage"),
        fullyLiable: z.boolean(),
        participantRole: z.string().nullable(),
        inGroup: z.boolean().openapi({
            description: "Whether the owner is itself a company in this group response — only those count towards 'tilsammen'",
        }),
    })
    .openapi({ description: "A registered owner of the company on the date" });

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
            description: "True when the registry lists the company under 'indgaaende': it went INTO the event as a transferring company",
            example: true,
        }),
        outgoing: z.boolean().openapi({
            description: "True when listed under 'udgaaende': it came OUT of the event as a receiving/continuing company",
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
    dateOfDissolution: z.string().nullable().openapi({
        description: "The date the company ceased to exist, or null while it exists",
        example: null,
    }),
    dissolutionReason: z.enum(["MERGER", "DEMERGER", "LIQUIDATION", "BANKRUPTCY", "OTHER"]).nullable().openapi({
        description: "Why the company ceased to exist, derived from its last registered status; null while it exists",
        example: null,
    }),
    dissolutionStatus: z.string().nullable().openapi({
        description: "The registry's own last status text, e.g. 'OPLØST EFTER FUSION'; null while the company is normal",
        example: null,
    }),
    restructurings: z
        .array(
            z.object({
                eventId: z.number().openapi({ description: "The registry's event id — identical on every party, use it to aggregate", example: 4010348162 }),
                type: z.enum(["MERGER", "DEMERGER"]),
                date: z.string().nullable().openapi({ example: "2025-03-21" }),
                role: z.enum(["TRANSFERRING", "RECEIVING"]).openapi({
                    description: "TRANSFERRING = indskydende (contributed its assets); RECEIVING = modtagende/continuing",
                }),
                dissolved: z.boolean().openapi({ description: "Whether this company ceased to exist in the event" }),
                counterparts: z.array(
                    z.object({
                        cvr: z.number(),
                        name: z.string(),
                        role: z.enum(["TRANSFERRING", "RECEIVING"]),
                        dissolved: z.boolean(),
                    }),
                ).openapi({ description: "The other parties, whether or not they were ever part of the group" }),
            }),
        )
        .openapi({
            description:
                "Mergers and demergers the company took part in, with the other parties resolved from the register. " +
                "All of them by default; only those inside the span in the period (from/to) and multi-snapshot (dates) views.",
        }),
    snapshots: z
        .array(
            z.object({
                date: z.string().openapi({ example: "2024-12-31" }),
                member: z.boolean().openapi({ description: "Whether the company was in the group under this parent on the date" }),
                ownershipPercentage: percentageSchema("ownership percentage"),
                votingRightsPercentage: percentageSchema("voting rights percentage"),
                fullyLiable: z.boolean(),
                participantRole: z.string().nullable(),
                owners: z.array(ownerSchema).openapi({ description: "Every registered owner of the company on the date" }),
            }),
        )
        .optional()
        .openapi({ description: "One entry per requested date. Only present in the multi-snapshot view (dates=…)." }),
    owners: z.array(ownerSchema).openapi({
        description:
            "Every owner registered for the company on the date the entry is read as of: group companies (inGroup = true), " +
            "external companies and persons. `parent` is one of them. Empty for the root when nothing is registered.",
    }),
    retrievedAt: z.string().openapi({ description: "When this response was produced (ISO timestamp)", example: "2026-09-12T08:00:00.000Z" }),
    registerUpdatedAt: z.string().nullable().openapi({
        description: "When the register last updated this company's record (sidstOpdateret)",
        example: "2026-08-01T10:15:00.000+02:00",
    }),
    ownershipPercentage: percentageSchema("ownership percentage"),
    votingRightsPercentage: percentageSchema("voting rights percentage"),
    ownershipHistory: z
        .array(
            z.object({
                from: z.string().openapi({
                    description: "First day the registered value applied (gyldigFra)",
                    example: "2016-07-25",
                }),
                to: z.string().nullable().openapi({
                    description: "Last day the value applied, or null while it still applies",
                    example: "2018-10-22",
                }),
                noticeDate: z.string().nullable().openapi({
                    description:
                        "Date of the ownership notice (ejerandel meddelelsesdato) — usually closer to the actual " +
                        "transfer than 'from', which is the registration date",
                    example: "2016-07-25",
                }),
                ownershipPercentage: percentageSchema("ownership percentage"),
                votingRightsPercentage: percentageSchema("voting rights percentage"),
            }),
        )
        .optional()
        .openapi({
            description:
                "Every ownership value the parent has had registered for this company, oldest first. " +
                "Only present when history=true. Empty for the root company.",
        }),
    membership: z
        .object({
            from: z.string().openapi({ description: "First day the parent's ownership was registered", example: "2016-07-25" }),
            to: z.string().nullable().openapi({
                description: "Last day the parent's ownership was registered, or null while still owned",
                example: null,
            }),
        })
        .nullable()
        .optional()
        .openapi({
            description: "When the company has been part of the group under its parent. Only present when history=true; null for the root company.",
        }),
    events: z
        .array(
            z.object({
                date: z.string().openapi({ example: "2023-04-01" }),
                type: z
                    .enum([
                        "JOINED",
                        "LEFT",
                        "OWNERSHIP_CHANGED",
                        "OWNER_CHANGED",
                        "DISSOLVED",
                        "MERGED_INTO",
                        "MERGED_FROM",
                        "SPLIT_INTO",
                        "SPLIT_FROM",
                    ])
                    .openapi({
                        description:
                            "JOINED/LEFT: the parent's ownership began/ended. OWNERSHIP_CHANGED: a new ownership or voting " +
                            "band was registered. OWNER_CHANGED: the company moved from another group company to this parent. " +
                            "DISSOLVED: the company ceased to exist. MERGED_INTO/SPLIT_INTO: the company was the transferring " +
                            "party of a merger/demerger (dissolved says whether it ceased). MERGED_FROM/SPLIT_FROM: it was the " +
                            "receiving party. Counterparts list the other parties.",
                    }),
                before: z
                    .object({
                        ownershipPercentage: percentageSchema("ownership percentage"),
                        votingRightsPercentage: percentageSchema("voting rights percentage"),
                    })
                    .optional(),
                after: z
                    .object({
                        ownershipPercentage: percentageSchema("ownership percentage"),
                        votingRightsPercentage: percentageSchema("voting rights percentage"),
                    })
                    .optional(),
                previousParent: z
                    .object({
                        name: z.string(),
                        cvr: z.number(),
                    })
                    .optional(),
                counterparts: z
                    .array(
                        z.object({
                            cvr: z.number(),
                            name: z.string(),
                            role: z.enum(["TRANSFERRING", "RECEIVING"]),
                            dissolved: z.boolean(),
                        }),
                    )
                    .optional(),
                dissolved: z.boolean().optional(),
            }),
        )
        .optional()
        .openapi({
            description:
                "What happened to the company's place in the group inside the period. Only present in the period view (from/to) and the multi-snapshot view (dates).",
        }),
    fullyLiable: z.boolean().openapi({
        description: "Whether the parent is registered as a fully liable participant (fuldt ansvarlig deltager), e.g. komplementar in a K/S",
        example: false,
    }),
    participantRole: z.string().nullable().openapi({
        description:
            "The parent's role in this company by legal form: KOMPLEMENTAR, KOMMANDITIST or KOMPLEMENTAR_OG_KOMMANDITIST (K/S); " +
            "KOMPLEMENTAR, KOMMANDITAKTIONÆR or KOMPLEMENTAR_OG_KOMMANDITAKTIONÆR (P/S); INTERESSENT (I/S); " +
            "FULDT_ANSVARLIG_DELTAGER otherwise; null for an ordinary shareholder",
        example: null,
    }),
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
    groupEntitiesFromNotes: z
        .array(groupEntityFromNotesSchema)
        .optional()
        .openapi({
            description:
                "Virksomheder nævnt i noterne til DETTE selskabs seneste årsrapport som (potentielt) en del af " +
                "koncernen — især udenlandske koncernselskaber, som ikke findes i CVR-registret. Selskaber, der " +
                "allerede indgår i koncernstrukturen, er frasorteret. Ejerandele er typisk koncernens samlede " +
                "(indirekte) andel og medtages kun, når de kunne udlæses med sikkerhed.",
            example: [],
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

export const querySchema = z
    .object({
    asOf: dateQueryParam(
        "asOf",
        "Vis koncernen, som den så ud på denne dato: ejerandele, stemmerettigheder, navne, selskabsform og " +
            "medlemskab af koncernen vælges ud fra registerets gyldighedsperioder. Udelades: som den ser ud nu.",
        "2023-12-31",
    ),
    history: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true")
        .openapi({
            description: "true: medtag ownershipHistory og membership pr. selskab (alle registrerede ejerandele over tid).",
            example: "true",
            param: { in: "query", name: "history", required: false },
        }),
    from: dateQueryParam(
        "from",
        "Periodevisning, start: medtag alle selskaber, der har været i koncernen på noget tidspunkt fra denne dato til 'to', " +
            "med ejerhistorik og hændelser (tilgået, afgået, ændret ejerandel, skiftet ejer, ophørt). Kræver 'to'; kan ikke kombineres med asOf.",
        "2022-01-01",
    ),
    to: dateQueryParam("to", "Periodevisning, slut. Selskabernes værdier læses pr. den sidste dag, de var i koncernen inden for perioden.", "2024-12-31"),
    dates: z
        .string()
        .transform((value, ctx) => {
            const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
            const isoDates = parts.map((part) => ({ part, iso: parseFlexibleDate(part) }));
            const bad = isoDates.find((d) => d.iso === null);
            if (bad) {
                ctx.addIssue({ code: "custom", message: `Datoen "${bad.part}" i parameteren dates kunne ikke genkendes som en gyldig kalenderdato.` });
                return z.NEVER;
            }
            const unique = [...new Set(isoDates.map((d) => d.iso as string))].sort();
            if (unique.length === 0 || unique.length > 12) {
                ctx.addIssue({ code: "custom", message: "Parameteren dates skal indeholde 1–12 datoer adskilt af komma." });
                return z.NEVER;
            }
            return unique;
        })
        .optional()
        .openapi({
            description:
                "Flere øjebliksbilleder i ét kald: kommaseparerede datoer (fx overdragelsesdagen og de tre seneste balancedage). " +
                "Svaret dækker alle selskaber, der var i koncernen på mindst én af datoerne, med `snapshots` pr. dato, " +
                "historik, medlemskab og hændelser for spændet fra første til sidste dato. Kan ikke kombineres med asOf eller from/to.",
            example: "2025-07-05,2024-12-31,2023-12-31,2022-12-31",
            param: { in: "query", name: "dates", required: false },
        }),
    includeFullyLiable: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true")
        .openapi({
            description:
                "true: medtag også selskaber, hvor koncernselskabet alene er fuldt ansvarlig deltager (fx komplementar i et K/S) " +
                "uden registreret ejerandel. Standard: kun ejerskaber fra Ejerregisteret.",
            example: "false",
            param: { in: "query", name: "includeFullyLiable", required: false },
        }),
    })
    .superRefine((query, ctx) => {
        if ((query.from === undefined) !== (query.to === undefined)) {
            ctx.addIssue({ code: "custom", message: "Parametrene from og to skal angives sammen." });
        }
        if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
            ctx.addIssue({ code: "custom", message: `Perioden er vendt om: from (${query.from}) ligger efter to (${query.to}).` });
        }
        if (query.asOf !== undefined && query.from !== undefined) {
            ctx.addIssue({ code: "custom", message: "asOf kan ikke kombineres med from/to. Brug enten et øjebliksbillede (asOf) eller en periode (from/to)." });
        }
        if (query.dates !== undefined && (query.asOf !== undefined || query.from !== undefined)) {
            ctx.addIssue({ code: "custom", message: "dates kan ikke kombineres med asOf eller from/to." });
        }
    });
