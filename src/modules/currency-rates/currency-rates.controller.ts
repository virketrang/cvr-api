import { createRoute } from "@hono/zod-openapi";

import { paramSchema, responseSchema } from "./currency-rates.schema.js";
import CurrencyRatesService from "./currency-rates.service.js";
import { errorResponses } from "../../utils/api-error.js";
import type { Context, Env } from "hono";

export const route = createRoute({
    method: "get",
    path: "/api/currency-rates/:currency/:date",
    description:
        "Returns the Nationalbanken exchange rate for a currency on a given date. " +
        "If the date is not a banking day, the most recent preceding banking day is used.",
    request: {
        params: paramSchema,
    },
    responses: {
        200: {
            description: "Exchange rate retrieved successfully",
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
        "/api/currency-rates/:currency/:date",
        {
            in: { param: { currency: string; date: string } };
            out: { param: { currency: string; date: string } };
        }
    >,
) => {
    // valid("param") returns the schema's OUTPUT — the date normalized to ISO
    // yyyy-mm-dd by paramSchema's transform — unlike ctx.req.param(), which
    // would hand the service the raw, possibly Danish-formatted value.
    const { currency, date } = ctx.req.valid("param");

    const rate = await CurrencyRatesService.getRate(currency, date);

    return ctx.json(rate, 200);
};
