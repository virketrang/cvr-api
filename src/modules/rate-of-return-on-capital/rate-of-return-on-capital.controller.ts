import { createRoute } from "@hono/zod-openapi";

import RateOfReturnOnCapitalService from "./rate-of-return-on-capital.service.js";
import { responseSchema } from "./rate-of-return-on-capital.schema.js";
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
