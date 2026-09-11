import { createRoute } from "@hono/zod-openapi";
import type { Context, Env } from "hono";

import { bodySchema, responseSchema, type ProjectResolutionRequestBody } from "./project-resolution.schema.js";
import ProjectResolutionService from "./project-resolution.service.js";
import { errorResponses } from "../../utils/api-error.js";

export const route = createRoute({
    method: "post",
    path: "/api/project-resolutions",
    description:
        "Resolves a complete workbook project for a corporate group: qualification flags, overview rows, " +
        "valuation inputs, passive-asset-test line items and advisory notes. The Excel client renders the " +
        "returned model into its sheets; all business rules run here.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: bodySchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: "The fully resolved project model.",
            content: {
                "application/json": {
                    schema: responseSchema,
                },
            },
        },
        ...errorResponses,
    },
});

export const router = async (
    ctx: Context<
        Env,
        "/api/project-resolutions",
        { in: { json: ProjectResolutionRequestBody }; out: { json: ProjectResolutionRequestBody } }
    >,
) => {
    const body = ctx.req.valid("json");

    const resolution = await ProjectResolutionService.resolveProject(body);

    return ctx.json(resolution, 200);
};
