import { z } from "zod";

/** Every deliberate failure the API returns. Anything else becomes a 500. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Unauthorized.") =>
  new AppError(401, message, "UNAUTHORIZED");

export const forbidden = (message = "You do not have access to this.") =>
  new AppError(403, message, "FORBIDDEN");

export const notFound = (message = "Not found.") => new AppError(404, message, "NOT_FOUND");

export const conflict = (message: string, code = "CONFLICT") => new AppError(409, message, code);

export const invalid = (message: string, details?: unknown) =>
  new AppError(422, message, "VALIDATION_FAILED", details);

/**
 * Parses a body against a shared contract and turns a Zod failure into a 422
 * the clients can render, instead of Elysia's raw schema error.
 */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw invalid("The request body is not valid.", z.treeifyError(result.error));
  }

  return result.data;
}
