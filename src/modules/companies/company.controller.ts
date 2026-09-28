import { createRoute } from "@hono/zod-openapi";

import { paramSchema, responseSchema } from "./company.schema.js";
import CompanyService from "./company.service.js";
import { AppError, errorResponses, ErrorCode } from "../../utils/api-error.js";
import type { Context, Env } from "hono";

export const route = createRoute({
    method: "get",
    path: "/api/companies/:cvrNumber",
    description:
        "Fast existence check for a danish business registration number (CVR-number): returns the company's " +
        "current name and registry status, or 404 when no company has that number. Built for validating an " +
        "input field as the user leaves it — it asks the registry for the name only and caches answers.",
    request: {
        params: paramSchema,
    },
    responses: {
        200: {
            description: "The company exists",
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
        "/api/companies/:cvrNumber",
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

    const company = await CompanyService.lookup(Number(cvrNumber));

    if (!company) {
        throw new AppError(ErrorCode.NOT_FOUND, `Der findes intet selskab med CVR-nummer ${cvrNumber}.`);
    }

    // The name rarely changes; let the client (or Excel's WebView) skip repeated blurs.
    ctx.header("Cache-Control", "private, max-age=600");
    return ctx.json(company, 200);
};
