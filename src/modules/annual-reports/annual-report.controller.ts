import { createRoute } from "@hono/zod-openapi";

import { batchBodySchema, batchResponseSchema, paramSchema, responseSchema } from "./annual-report.schema.js";
import AnnualReportService from "./annual-report.service.js";
import { errorResponses } from "../../utils/api-error.js";
import type { Context, Env } from "hono";

export const route = createRoute({
    method: "get",
    path: "/api/annual-reports/:cvrNumber",
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
        ...errorResponses,
    },
});

export const router = async (
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
    >,
) => {
    const cvrNumber = ctx.req.param("cvrNumber");

    const annualReports = await AnnualReportService.getAnnualReports(Number(cvrNumber));

    return ctx.json(annualReports, 200);
};

export const batchRoute = createRoute({
    method: "post",
    path: "/api/annual-reports/batch",
    description:
        "Returns annual reports for many CVR-numbers in one request. " +
        "Each company is fetched independently; a single failure does not fail the batch.",
    request: {
        body: {
            content: { "application/json": { schema: batchBodySchema } },
        },
    },
    responses: {
        200: {
            description: "Batch annual reports retrieved",
            content: { "application/json": { schema: batchResponseSchema } },
        },
        ...errorResponses,
    },
});

export const batchRouter = async (
    ctx: Context<
        Env,
        "/api/annual-reports/batch",
        { in: { json: { cvrNumbers: string[] } }; out: { json: { cvrNumbers: string[] } } }
    >,
) => {
    const { cvrNumbers } = ctx.req.valid("json");
    const batch = await AnnualReportService.getAnnualReportsBatch(cvrNumbers.map((cvr) => Number(cvr)));
    return ctx.json(batch, 200);
};
