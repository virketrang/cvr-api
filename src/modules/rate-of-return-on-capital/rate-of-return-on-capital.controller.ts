import { createRoute } from "@hono/zod-openapi";

import RateOfReturnOnCapitalService from "./rate-of-return-on-capital.service.js";
import { atDateParamSchema, atDateResponseSchema, responseSchema } from "./rate-of-return-on-capital.schema.js";
import { AppError, errorResponses, ErrorCode } from "../../utils/api-error.js";
import type { Context, Env } from "hono";

export const route = createRoute({
    method: "get",
    path: "/api/rate-of-return-on-capital",
    description: "Returns a list of the rate of return on capital for different years.",
    responses: {
        200: {
            description: "Rate of return on capital retrieved successfully",
            content: {
                "application/json": {
                    schema: responseSchema,
                },
            },
        },
        ...errorResponses,
    },
});

export const router = async (ctx: Context<Env, "/api/rate-of-return-on-capital", {}>) => {
    const currentYear = new Date().getFullYear();
    const rateofReturnOnCapitalList = await RateOfReturnOnCapitalService.getRateOfReturnOnCapital();

    if (!rateofReturnOnCapitalList) {
        throw new AppError(ErrorCode.NOT_FOUND, "Kapitalafkastsatsen kunne ikke findes på skat.dk.");
    }

    const currentYearData = rateofReturnOnCapitalList.find((item) => item.year === currentYear);
    const previousYearData = rateofReturnOnCapitalList.find((item) => item.year === currentYear - 1);

    if (currentYearData && currentYearData.value !== null) {
        return ctx.json(currentYearData, 200);
    }

    if (previousYearData && previousYearData.value !== null) {
        return ctx.json(previousYearData, 200);
    }

    throw new AppError(ErrorCode.NOT_FOUND, "Der findes ingen kapitalafkastsats for indeværende eller forrige år.");
};

export const atDateRoute = createRoute({
    method: "get",
    path: "/api/rate-of-return-on-capital/:date",
    description:
        "Returns the rate of return on capital (kapitalafkastsats) that was the most recently published one " +
        "on the given date — the rate in force at a transfer date under boafgiftslovens § 12 a. " +
        "The yearly rate is announced in August/September, so the calendar year is not what decides.",
    request: {
        params: atDateParamSchema,
    },
    responses: {
        200: {
            description: "Rate of return on capital in force on the date retrieved successfully",
            content: {
                "application/json": {
                    schema: atDateResponseSchema,
                },
            },
        },
        ...errorResponses,
    },
});

export const atDateRouter = async (
    ctx: Context<
        Env,
        "/api/rate-of-return-on-capital/:date",
        {
            in: { param: { date: string } };
            out: { param: { date: string } };
        }
    >,
) => {
    // valid("param") returns the schema's OUTPUT — the date normalized to ISO yyyy-mm-dd.
    const { date } = ctx.req.valid("param");

    const rate = await RateOfReturnOnCapitalService.getRateOfReturnOnCapitalAtDate(date);

    return ctx.json(rate, 200);
};
