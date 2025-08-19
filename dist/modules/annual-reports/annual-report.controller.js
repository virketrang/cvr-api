import { createRoute, z } from "@hono/zod-openapi";
import { OpenAPIHono } from "@hono/zod-openapi";
import { paramSchema, responseSchema } from "./annual-report.schema.js";
import AnnualReportService from "./annual-report.service.js";
const annualReportsRoute = createRoute({
    method: "get",
    path: "/annual-reports/:cvrNumber",
    description: "Returns the annual reports for a given danish business registration number (CVR-number).",
    request: {
        params: paramSchema,
    },
    responses: {
        200: {
            description: "Annual reports retrieved successfully",
            content: {
                "application/json": {
                    schema: responseSchema,
                },
            },
        },
    },
});
export const annualReportsRouter = new OpenAPIHono().openapi(annualReportsRoute, async (ctx) => {
    const cvrNumber = ctx.req.param("cvrNumber");
    const annualReports = await AnnualReportService.getAnnualReports(Number(cvrNumber));
    return ctx.json(annualReports, 200);
});
