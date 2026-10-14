import pino from "pino";

const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  // Never write secrets or session cookies to the logs.
  redact: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']"],
  transport: isDev ? { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } } : undefined,
});
