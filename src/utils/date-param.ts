import { z } from "@hono/zod-openapi";

import { parseFlexibleDate } from "./format-date.js";

const FORMATS_HINT =
    "Accepterer ISO (2025-12-31), dansk (31-12-2025), kompakt (20251231, 31122025), - / . som skilletegn " +
    "samt danske/engelske månedsnavne ('31. december 2025'). Ved / eller mellemrum skal værdien URL-enkodes (%2F, %20).";

/**
 * A path parameter holding a calendar date in any common Danish/ISO/English
 * format. The schema's OUTPUT is the date normalized to ISO yyyy-mm-dd, so read
 * it with `ctx.req.valid("param")` — `ctx.req.param()` would hand back the raw text.
 */
export function datePathParam(name: string, description: string, example: string) {
    return z
        .string()
        .transform((value, ctx) => {
            const isoDate = parseFlexibleDate(value);
            if (!isoDate) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        `Datoen "${value}" kunne ikke genkendes som en gyldig kalenderdato. ` +
                        "Understøttede formater: 2025-12-31, 31-12-2025, 20251231, 31122025 " +
                        "(også med / eller . som skilletegn) samt månedsnavne, fx '31. december 2025'.",
                });
                return z.NEVER;
            }
            return isoDate;
        })
        .openapi({
            description: `${description} ${FORMATS_HINT}`,
            example,
            param: { in: "path", name, required: true },
        });
}
