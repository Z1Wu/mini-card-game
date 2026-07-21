/**
 * Keeps unexpected diagnostics available during local development without
 * exposing routine connection activity or player data in production consoles.
 */
export const logUnexpectedError = (context: string, error?: unknown): void => {
  if (import.meta.env.DEV) {
    console.error(context, error);
  }
};
