import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { basicAuth } from "hono/basic-auth";
import { bearerAuth } from "hono/bearer-auth";
import { some } from "hono/combine";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Scalar } from "@scalar/hono-api-reference";
import chalk from "chalk";

import environment from "./environment.js";
import endpoints, { baseUrl } from "./routes.js";
import { ErrorCode, toAppError, type ApiErrorBody } from "./utils/api-error.js";
import { rateLimit } from "./utils/rate-limit.js";

import * as corporateGroups from "./modules/corporate-group-structures/corporate-group.controller.js";
import * as annualReports from "./modules/annual-reports/annual-report.controller.js";
import * as version from "./modules/version/version.controller.js";
import * as rateOfReturnOnCapital from "./modules/rate-of-return-on-capital/rate-of-return-on-capital.controller.js";
import * as currencyRates from "./modules/currency-rates/currency-rates.controller.js";

const app = new OpenAPIHono({
    defaultHook: (result, ctx) => {
        if (!result.success) {
            const body: ApiErrorBody = {
                status: "error",
                errorCode: ErrorCode.INVALID_CVR,
                message: result.error.issues[0]?.message ?? "Ugyldigt input.",
            };
            return ctx.json(body, 422);
        }
    },
});

app.use("*", cors());

// Declare the charset explicitly on JSON responses. The bodies are UTF-8, but without
// "charset=utf-8" in the header several common consumers (Excel/Power Query, PHP, older
// Java HTTP clients) fall back to ISO-8859-1 and mangle Æ/Ø/Å in company names.
app.use("*", async (ctx, next) => {
    await next();
    const contentType = ctx.res.headers.get("content-type");
    if (contentType?.startsWith("application/json") && !contentType.includes("charset")) {
        ctx.res.headers.set("content-type", "application/json; charset=utf-8");
    }
});

app.use(
    "/api/*",
    some(
        bearerAuth({ token: environment.API_KEY }),
        basicAuth({
            username: environment.API_USERNAME,
            password: environment.API_PASSWORD,
        }),
    ),
);

app.use("/api/*", rateLimit());

app.openapi(corporateGroups.route, corporateGroups.router);
app.openapi(corporateGroups.flattenedRoute, corporateGroups.flattenedRouter);
app.openapi(annualReports.route, annualReports.router);
app.openapi(annualReports.batchRoute, annualReports.batchRouter);
app.openapi(version.route, version.router);
app.openapi(rateOfReturnOnCapital.route, rateOfReturnOnCapital.router);
app.openapi(currencyRates.route, currencyRates.router);

app.get(
    "/documentation",
    Scalar({
        url: "/openapi",
        theme: "purple",
    }),
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
    return ctx.json(
        {
            message: `404 - Page not found. Please check the URL or refer to the API documentation.`,
        },
        404,
    );
});

app.onError((err, ctx) => {
    if (err instanceof HTTPException) {
        return err.getResponse();
    }

    const appError = toAppError(err);

    console.error(
        `[${appError.errorCode}] ${appError.message}`,
        err instanceof Error && err.stack ? `\n${err.stack}` : err,
    );

    const body: ApiErrorBody = {
        status: "error",
        errorCode: appError.errorCode,
        message: appError.message,
    };

    return ctx.json(body, appError.httpStatus as 404 | 422 | 429 | 500 | 503);
});

serve(
    {
        fetch: app.fetch,
        port: environment.PORT,
    },
    () => {
        console.log(chalk.green(`\nServer is running at:`), chalk.blue.bold(baseUrl));
        console.log(chalk.blue.bold("\nAvailable API-endpoints:"));
        console.table(endpoints);
    },
);
