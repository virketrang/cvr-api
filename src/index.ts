import { serve } from "@hono/node-server";
import chalk from "chalk";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bearerAuth } from "hono/bearer-auth";

import environment from "./environment.js";
import {
    corporateGroupFlattenedRoute,
    corporateGroupFlattenedRouter,
    corporateGroupRoute,
    corporateGroupRouter,
} from "./modules/corporate-group-structures/corporate-group.controller.js";
import { annualReportsRoute, annualReportsRouter } from "./modules/annual-reports/annual-report.controller.js";
import { Scalar } from "@scalar/hono-api-reference";

export const versionRoute = createRoute({
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
    },
});

const app = new OpenAPIHono();

app.use(
    "/api",
    bearerAuth({
        token: environment.API_KEY,
    })
);

app.openapi(corporateGroupRoute, corporateGroupRouter);
app.openapi(corporateGroupFlattenedRoute, corporateGroupFlattenedRouter);
app.openapi(annualReportsRoute, annualReportsRouter);
app.openapi(versionRoute, (ctx) => {
    return ctx.json({ version: "1.0.0" });
});

app.get(
    "/documentation",
    Scalar({
        url: "/openapi",
        theme: "purple",
    })
);

app.doc("/openapi", {
    openapi: "3.0.0",
    info: {
        title: "Danish Business Information API",
        version: "1.0.0",
        description:
            "API for getting corporate group structures and annual reports for danish companies based on danish business registration numbers (CVR-numbers).",
    },
});

app.notFound((ctx) => {
    return ctx.json({
        message: `404 - Page not found. Please check the URL or refer to the API documentation.`,
    });
});

app.onError((err, ctx) => {
    console.log(err);

    return ctx.json(
        {
            error: "An unexpected error occurred. Please try again later.",
        },
        500
    );
});

serve(
    {
        fetch: app.fetch,
        port: environment.PORT,
    },
    (info) => {
        const hostname = process.env.HOSTNAME || "localhost";

        // Find protokollen baseret på miljøvariabler
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

        const baseUrl = `${protocol}://${hostname}:${info.port}`;

        console.log(chalk.green(`\nServer is running at:`), chalk.blue.bold(`${protocol}://${hostname}:${info.port}`));

        // Define the API endpoints
        const endpoints = [
            {
                "HTTP-Metode": "GET",
                Endpoint: `${baseUrl}/api/v1/corporate-group/:cvrNumber`,
                Description:
                    "Returns the corporate group structure for a given danish business registration number (CVR-number).",
            },
            {
                "HTTP-Metode": "GET",
                Endpoint: `${baseUrl}/api/v1/annual-reports/:cvrNumber`,
                Description: "Returns the annual reports for a given danish business registration number (CVR-number).",
            },
            {
                "HTTP-Metode": "GET",
                Endpoint: `${baseUrl}/api/version`,
                Description: "Returns the current version of the API.",
            },
            {
                "HTTP-Metode": "GET",
                Endpoint: `${baseUrl}/documentation`,
                Description: "API documentation and reference.",
            },
        ];

        // Display the endpoints in a table
        console.log(chalk.blue.bold("\nAvailable API-endpoints:"));
        console.table(endpoints);
    }
);
