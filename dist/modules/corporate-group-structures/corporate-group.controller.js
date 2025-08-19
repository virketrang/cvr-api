import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { OpenAPIHono } from "@hono/zod-openapi";
import CorporateGroupService from "./corporate-group.service.js";
import { responseSchema, paramSchema } from "./corporate-group.schema.js";
const corporateGroupRoute = createRoute({
    method: "get",
    path: "/corporate-group/:cvrNumber",
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
export const corporateGroupRouter = new OpenAPIHono().openapi(corporateGroupRoute, async (ctx) => {
    const cvrNumber = ctx.req.param("cvrNumber");
    const corporateGroup = await CorporateGroupService.getCorporateGroup(Number(cvrNumber));
    if (!corporateGroup) {
        return ctx.json({
            message: `No corporate group structure found for CVR number ${cvrNumber}.`,
        }, 404);
    }
    return ctx.json(corporateGroup, 200);
});
