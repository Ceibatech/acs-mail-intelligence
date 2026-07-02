const isProduction = process.env.NODE_ENV === "production";
const enableLogging = process.env.ENABLE_ERROR_LOGS !== "false";

export function logError(context: string, error: unknown) {
  if (isProduction && !enableLogging) return;
  if (error instanceof Error) {
    console.error(`[${context}] ${error.message}`);
  } else {
    console.error(`[${context}]`, error);
  }
}
