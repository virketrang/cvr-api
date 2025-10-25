import { createRoute } from "@hono/zod-openapi";

import { responseSchema } from "./annual-report.schema.js";
import AnnualReportService from "./annual-report.service.js";
import type { Context, Env } from "hono";

export const annualReportsRoute = createRoute({
    method: "get",
    path: "/api/annual-reports/:cvrNumber",
    description: "Returns the annual reports for a given danish business registration number (CVR-number).",
    // request: {
    //     params: paramSchema,
    // },
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

export const annualReportsRouter = async (
    ctx: Context<
        Env,
        "/api/annual-reports/:cvrNumber",
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

    const annualReports = await AnnualReportService.getAnnualReports(Number(cvrNumber));

    return ctx.json(annualReports, 200);
};
