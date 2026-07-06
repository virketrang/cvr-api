import environment from "./environment.js";

import * as corporateGroups from "./modules/corporate-group-structures/corporate-group.controller.js";
import * as annualReports from "./modules/annual-reports/annual-report.controller.js";
import * as version from "./modules/version/version.controller.js";
import * as rateOfReturnOnCapital from "./modules/rate-of-return-on-capital/rate-of-return-on-capital.controller.js";
import * as currencyRates from "./modules/currency-rates/currency-rates.controller.js";

export const hostname = process.env.HOSTNAME || "localhost";

export const protocol = environment.NODE_ENV === "production" ? "https" : "http";

export const baseUrl = `${protocol}://${hostname}:${environment.PORT}`;

// The startup table is derived from the modules' route definitions, so a new or
// changed route can never leave it stale.
const apiRoutes = [
    version.route,
    corporateGroups.route,
    corporateGroups.flattenedRoute,
    annualReports.route,
    annualReports.batchRoute,
    rateOfReturnOnCapital.route,
    currencyRates.route,
];

const endpoints = [
    {
        "HTTP-Metode": "GET",
        Endpoint: `${baseUrl}/documentation`,
        Description: "API documentation and reference.",
    },
    ...apiRoutes.map((route) => ({
        "HTTP-Metode": route.method.toUpperCase(),
        Endpoint: `${baseUrl}${route.path}`,
        Description: route.description ?? "",
    })),
];

export default endpoints;
