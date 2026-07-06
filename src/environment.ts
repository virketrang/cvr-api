import "dotenv/config";
import chalk from "chalk";
import z from "zod";

const environmentSchema = z.object({
    API_VERSION: z.string({
        error: (issue) => {
            if (issue.input === undefined) {
                return { message: "API_VERSION må ikke være tom." };
            }
            return { message: "API_VERSION skal være en streng." };
        },
    }),
    API_KEY: z
        .string({
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "API-nøglen må ikke være tom." };
                }
                return { message: "API-nøglen skal være en streng." };
            },
        })
        .min(64, { message: "API-nøglen skal være mindst 64 tegn lang." }),
    PORT: z.coerce
        .number({
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "Portnummeret må ikke være tomt." };
                }
                return { message: "Portnummeret skal være et tal." };
            },
        })
        .default(3000)
        .refine((port) => port > 0, { message: "Portnummeret skal være større end 0." }),
    NODE_ENV: z
        .enum(["development", "production"], {
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "NODE_ENV må ikke være tom." };
                }
                return { message: "NODE_ENV skal være enten 'development' eller 'production'." };
            },
        })
        .default("development"),
    DOCUMENTATION_USERNAME: z
        .string({
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "Dokumentationsbrugernavn må ikke være tomt." };
                }
                return { message: "Dokumentationsbrugernavn skal være en streng." };
            },
        })
        .min(1, "Dokumentationsbrugernavn må ikke være tomt."),
    DOCUMENTATION_PASSWORD: z
        .string({
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "Dokumentationsadgangskode må ikke være tom." };
                }
                return { message: "Dokumentationsadgangskode skal være en streng." };
            },
        })
        .min(1, "Dokumentationsadgangskode må ikke være tom."),
    CVR_API_USERNAME: z
        .string({
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "CVR API-brugernavn må ikke være tomt." };
                }
                return { message: "CVR API-brugernavn skal være en streng." };
            },
        })
        .min(1, "CVR API-brugernavn må ikke være tomt."),
    CVR_API_PASSWORD: z
        .string({
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "CVR API-adgangskode må ikke være tom." };
                }
                return { message: "CVR API-adgangskode skal være en streng." };
            },
        })
        .min(1, "CVR API-adgangskode må ikke være tom."),
});

const env = environmentSchema.safeParse(process.env);

if (!env.success) {
    const errors = z.treeifyError(env.error);

    if (!errors.properties) {
        console.error("Miljøvariablerne er indstillet forkert. Sørg for, at alle nødvendige variabler er defineret.");
    } else {
        const message = Object.entries(errors.properties)
            .map(([key, value]) => `${key}: ${value.errors.map((error) => error).join(", ")}`)
            .join("\n");
        console.error(`Miljøvariablerne er indstillet forkert:\n${message}`);
    }

    process.exit(1);
}

console.log(chalk.yellow("✔ Environment variables loaded succesfully."));

export default env.data;
