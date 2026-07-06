import { createRoute, z } from "@hono/zod-openapi";
import type { Context, Env } from "hono";

import environment from "../../environment.js";
import { errorResponses } from "../../utils/api-error.js";

export const route = createRoute({
    method: "get",
    path: "/api/version",
    description: "Returns the current version of the API.",
    responses: {
        200: {
            description: "API version retrieved successfully",
            content: {
                "application/json": {
                    schema: z.object({
                        version: z.string().openapi({
                            description: "The current version of the API",
                            example: "1.0.0",
                        }),
                    }),
                },
            },
        },
        ...errorResponses,
    },
});

export const router = async (ctx: Context<Env, "/api/version", {}>) => {
    return ctx.json(
        {
            version: environment.API_VERSION,
        },
        200,
    );
};
