import { createRoute } from "@hono/zod-openapi";

import CorporateGroupService from "./corporate-group.service.js";
import { AppError, errorResponses, ErrorCode } from "../../utils/api-error.js";
import { responseSchema, paramSchema, querySchema, responseFlattenedSchema } from "./corporate-group.schema.js";
import type { Context, Env } from "hono";

export const route = createRoute({
    method: "get",
    path: "/api/corporate-groups/:cvrNumber",
    description:
        "Returns the corporate group structure for a given danish business registration number (CVR-number). " +
        "Use ?asOf=yyyy-mm-dd to see the group as it was on a date (ownership, names, membership), " +
        "?history=true to include every registered ownership value over time per company, " +
        "?from=&to= for the period view (every company that was in the group at any point, with history and events), " +
        "?dates=d1,d2,… for several snapshots in one call (period view plus one snapshot per date), and " +
        "?includeFullyLiable=true to also follow komplementar-style relations without an ownership share.",
    request: {
        params: paramSchema,
        query: querySchema,
    },
    responses: {
        200: {
            description: "Corporate group structure retrieved successfully",
            content: {
                "application/json": {
                    schema: responseSchema,
                },
            },
        },
        ...errorResponses,
    },
});

export const flattenedRoute = createRoute({
    method: "get",
    path: "/api/corporate-groups/:cvrNumber/flattened",
    description:
        "Returns the corporate group structure for a given danish business registration number (CVR-number) as a flat array. " +
        "Supports the same ?asOf, ?history, ?from/?to, ?dates and ?includeFullyLiable query parameters as the tree endpoint. " +
        "In the period view a company owned by two group companies in turn appears once per parent.",
    request: {
        params: paramSchema,
        query: querySchema,
    },
    responses: {
        200: {
            description: "Corporate group structure retrieved successfully",
            content: {
                "application/json": {
                    schema: responseFlattenedSchema,
                },
            },
        },
        ...errorResponses,
    },
});

export const router = async (
    ctx: Context<
        Env,
        "/api/corporate-groups/:cvrNumber",
        {
            in: {
                param: {
                    cvrNumber: unknown;
                };
                query: {
                    asOf?: string;
                    history?: string;
                    from?: string;
                    to?: string;
                    dates?: string;
                    includeFullyLiable?: string;
                };
            };
            out: {
                param: {
                    cvrNumber: string;
                };
                query: {
                    asOf?: string;
                    history: boolean;
                    from?: string;
                    to?: string;
                    dates?: string[];
                    includeFullyLiable: boolean;
                };
            };
        }
    >,
) => {
    const cvrNumber = ctx.req.param("cvrNumber");
    const { asOf, history, from, to, dates, includeFullyLiable } = ctx.req.valid("query");

    const corporateGroup = await CorporateGroupService.getCorporateGroup(Number(cvrNumber), {
        asOf: asOf ?? null,
        history,
        window: from !== undefined && to !== undefined ? { from, to } : dates ? { from: dates[0], to: dates[dates.length - 1] } : null,
        dates: dates ?? null,
        includeFullyLiable,
    });

    if (!corporateGroup) {
        throw new AppError(
            ErrorCode.NOT_FOUND,
            `Der blev ikke fundet en koncernstruktur for CVR-nummer ${cvrNumber}.`,
        );
    }

    return ctx.json(corporateGroup, 200);
};

export const flattenedRouter = async (
    ctx: Context<
        Env,
        "/api/corporate-groups/:cvrNumber/flattened",
        {
            in: {
                param: {
                    cvrNumber: unknown;
                };
                query: {
                    asOf?: string;
                    history?: string;
                    from?: string;
                    to?: string;
                    dates?: string;
                    includeFullyLiable?: string;
                };
            };
            out: {
                param: {
                    cvrNumber: string;
                };
                query: {
                    asOf?: string;
                    history: boolean;
                    from?: string;
                    to?: string;
                    dates?: string[];
                    includeFullyLiable: boolean;
                };
            };
        }
    >,
) => {
    const cvrNumber = ctx.req.param("cvrNumber");
    const { asOf, history, from, to, dates, includeFullyLiable } = ctx.req.valid("query");

    const corporateGroup = await CorporateGroupService.getCorporateGroup(Number(cvrNumber), {
        flatten: true,
        asOf: asOf ?? null,
        history,
        window: from !== undefined && to !== undefined ? { from, to } : dates ? { from: dates[0], to: dates[dates.length - 1] } : null,
        dates: dates ?? null,
        includeFullyLiable,
    });

    if (!corporateGroup) {
        throw new AppError(
            ErrorCode.NOT_FOUND,
            `Der blev ikke fundet en koncernstruktur for CVR-nummer ${cvrNumber}.`,
        );
    }

    return ctx.json(corporateGroup, 200);
};
