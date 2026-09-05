import { Elysia } from "elysia";
import { principalFromHeader, type Principal } from "./auth";
import { AppError } from "./errors";

/**
 * Turns a bearer token into a `principal` for every route that uses it.
 * Applying it as a plugin keeps the 401 in one place instead of at the top of
 * each handler.
 */
export const authenticated = new Elysia({ name: "authenticated" }).derive(
  { as: "scoped" },
  async ({ headers }): Promise<{ principal: Principal }> => ({
    principal: await principalFromHeader(headers.authorization),
  }),
);

/** Maps `AppError` onto its status and hides the shape of anything else. */
export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  { as: "global" },
  ({ error, code, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;

      return {
        message: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      };
    }

    if (code === "VALIDATION") {
      set.status = 422;

      return { message: "The request is not valid.", code: "VALIDATION_FAILED" };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;

      return { message: "Not found.", code: "NOT_FOUND" };
    }

    console.error("[api] unhandled error", error);
    set.status = 500;

    return { message: "Something went wrong.", code: "INTERNAL_ERROR" };
  },
);
