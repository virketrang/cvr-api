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

import * as corporateGroups from "./modules/corporate-group-structures/corporate-group.controller.js";
import * as annualReports from "./modules/annual-reports/annual-report.controller.js";
import * as version from "./modules/version/version.controller.js";
import * as rateOfReturnOnCapital from "./modules/rate-of-return-on-capital/rate-of-return-on-capital.controller.js";
import * as currencyRates from "./modules/currency-rates/currency-rates.controller.js";

const app = new OpenAPIHono({
    // Request-validation failures must speak the same structured error language as
    // everything else (ApiErrorBody with an errorCode the VBA client can switch on)
    // instead of zod-openapi's default raw ZodError body.
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

// Enable CORS for all routes
app.use("*", cors());

// Protect every /api/* endpoint. NOTE: the path MUST be "/api/*" — Hono's use()
// matches "/api" as an exact path only, so without the wildcard the auth check
// never runs for the actual endpoints.
// `some(...)` passes if EITHER scheme succeeds: a bearer API_KEY, or basic auth
// with the DOCUMENTATION_* credentials.
app.use(
    "/api/*",
    some(
        bearerAuth({ token: environment.API_KEY }),
        basicAuth({
            username: environment.DOCUMENTATION_USERNAME,
            password: environment.DOCUMENTATION_PASSWORD,
        }),
    ),
);

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
    // A custom onError fully replaces Hono's default handler, which returns
    // err.getResponse() for HTTPExceptions. Preserve that so framework-thrown
    // exceptions — notably the bearer/basic auth 401s with their WWW-Authenticate
    // header — return correctly instead of being flattened into a generic 500.
    if (err instanceof HTTPException) {
        return err.getResponse();
    }

    // Every other error — AppErrors thrown by services/controllers as well as
    // unexpected ones — is normalized to the shared ApiErrorBody shape here, so
    // the errorCode contract holds without per-controller try/catch wrappers.
    const appError = toAppError(err);

    console.error(`[${appError.errorCode}] ${appError.message}`, err instanceof Error && err.stack ? `\n${err.stack}` : "");

    const body: ApiErrorBody = {
        status: "error",
        errorCode: appError.errorCode,
        message: appError.message,
    };

    return ctx.json(body, appError.httpStatus as 404 | 422 | 500 | 503);
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
