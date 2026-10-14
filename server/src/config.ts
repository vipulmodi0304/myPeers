import { z } from "zod";

/**
 * All configuration comes from environment variables and is validated once at
 * startup, so a missing or malformed value fails fast with a clear message
 * instead of causing a confusing error later.
 */
const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  // Public URL of the site, used in emails and for the CSRF origin check.
  APP_URL: z.string().url().default("http://localhost:5173"),
  // Where uploaded chat files are written. Mount a Railway volume here.
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(25).default(10),
  // Only emails ending in this domain may sign up.
  ALLOWED_EMAIL_DOMAIN: z.string().default("mail.mcgill.ca"),
  REQUIRE_EMAIL_VERIFICATION: bool.default("true"),
  EMAIL_PROVIDER: z.enum(["log", "brevo", "resend"]).default("log"),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default("myPeers"),
  DEMO_ENABLED: bool.default("true"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const config = parsed.data;

  if (config.EMAIL_PROVIDER !== "log" && (!config.EMAIL_API_KEY || !config.EMAIL_FROM)) {
    throw new Error(`EMAIL_PROVIDER=${config.EMAIL_PROVIDER} needs EMAIL_API_KEY and EMAIL_FROM`);
  }
  if (config.NODE_ENV === "production") {
    if (!config.APP_URL.startsWith("https://")) {
      throw new Error("APP_URL must use https:// in production (secure cookies depend on it)");
    }
    if (config.REQUIRE_EMAIL_VERIFICATION && config.EMAIL_PROVIDER === "log") {
      throw new Error(
        "REQUIRE_EMAIL_VERIFICATION=true but EMAIL_PROVIDER=log, so nobody could receive their code. " +
          "Configure an email provider or set REQUIRE_EMAIL_VERIFICATION=false.",
      );
    }
  }
  return config;
}
