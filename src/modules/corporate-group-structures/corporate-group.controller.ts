import { createRoute } from "@hono/zod-openapi";

import CorporateGroupService from "./corporate-group.service.js";
import { AppError, errorResponses, ErrorCode } from "../../utils/api-error.js";
import { responseSchema, paramSchema, responseFlattenedSchema } from "./corporate-group.schema.js";
import type { Context, Env } from "hono";

export const route = createRoute({
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
        ...errorResponses,
    },
});

export const flattenedRoute = createRoute({
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
            };
            out: {
                param: {
                    cvrNumber: string;
                };
            };
        }
    >,
) => {
    const cvrNumber = ctx.req.param("cvrNumber");

    const corporateGroup = await CorporateGroupService.getCorporateGroup(Number(cvrNumber));

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
            };
            out: {
                param: {
                    cvrNumber: string;
                };
            };
        }
    >,
) => {
    const cvrNumber = ctx.req.param("cvrNumber");

    const corporateGroup = await CorporateGroupService.getCorporateGroup(Number(cvrNumber), { flatten: true });

    if (!corporateGroup) {
        throw new AppError(
            ErrorCode.NOT_FOUND,
            `Der blev ikke fundet en koncernstruktur for CVR-nummer ${cvrNumber}.`,
        );
    }

    return ctx.json(corporateGroup, 200);
};
