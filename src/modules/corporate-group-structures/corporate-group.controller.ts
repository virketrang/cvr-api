import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";

import CorporateGroupService from "./corporate-group.service.js";
import { responseSchema, paramSchema, responseFlattenedSchema } from "./corporate-group.schema.js";
import type { Context, Env } from "hono";

export const corporateGroupRoute = createRoute({
    method: "get",
    path: "/api/corporate-groups/:cvrNumber",
    description: "Returns the corporate group structure for a given danish business registration number (CVR-number).",
    request: {
        params: paramSchema,
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
        404: {
            description: "Corporate group structure not found",
            content: {
                "application/json": {
                    schema: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
    },
});

export const corporateGroupFlattenedRoute = createRoute({
    method: "get",
    path: "/api/corporate-groups/:cvrNumber/flattened",
    description:
        "Returns the corporate group structure for a given danish business registration number (CVR-number) as a flat array.",
    request: {
        params: paramSchema,
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
        404: {
            description: "Corporate group structure not found",
            content: {
                "application/json": {
                    schema: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
    },
});

export const corporateGroupRouter = async (
    ctx: Context<
        Env,
        "/api/corporate-groups/:cvrNumber",
        {
            in: {
                param: {
                    cvrNumber: unknown;
                };
            };
            out: {
                param: {
                    cvrNumber: string;
                };
            };
        }
    >
) => {
    const cvrNumber = ctx.req.param("cvrNumber");

    const corporateGroup = await CorporateGroupService.getCorporateGroup(Number(cvrNumber));

    if (!corporateGroup) {
        return ctx.json(
            {
                message: `No corporate group structure found for CVR number ${cvrNumber}.`,
            },
            404
        );
    }

    return ctx.json(corporateGroup, 200);
};

export const corporateGroupFlattenedRouter = async (
    ctx: Context<
        Env,
        "/api/corporate-groups/:cvrNumber/flattened",
        {
            in: {
                param: {
                    cvrNumber: unknown;
                };
            };
            out: {
                param: {
                    cvrNumber: string;
                };
            };
        }
    >
) => {
    const cvrNumber = ctx.req.param("cvrNumber");

    const corporateGroup = await CorporateGroupService.getCorporateGroup(Number(cvrNumber), { flatten: true });

    if (!corporateGroup) {
        return ctx.json(
            {
                message: `No corporate group structure found for CVR number ${cvrNumber}.`,
            },
            404
        );
    }

    return ctx.json(corporateGroup, 200);
};
