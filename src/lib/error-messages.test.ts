/**
 * How an unreachable backend reaches the user (issue #28, AC-8).
 *
 * `ServiceError.status === 0` means no HTTP response was produced. It sits
 * below every branch in `useErrorHandler`, so it lands in the generic handler
 * and its message has to come from the `error_code` map. These cases pin that
 * pairing, because the alternative — a status the handler treats as "server
 * error" — would misreport a dead backend as a broken request.
 */
import { describe, expect, it } from "vitest";
import { getToastMessage, getUserFriendlyError } from "./error-messages";
import { ServiceError } from "@/services/types";

describe("BACKEND_UNREACHABLE (ServiceError.status === 0)", () => {
  const error = new ServiceError(0, "GET /jobs failed: backend unreachable");
  error.error_code = "BACKEND_UNREACHABLE";
  error.detail = "Failed to fetch";

  it("maps to a connection message, not the generic one", () => {
    const friendly = getUserFriendlyError(error);

    expect(friendly.message).toBe("Cannot reach the cluster backend");
    expect(friendly.suggestion).toContain("backend is running");
    expect(getToastMessage(error)).not.toContain("An unexpected error occurred");
    expect(getToastMessage(error)).not.toBe("Failed to fetch");
  });

  it("is not swallowed by the status ladder (0 < 500)", () => {
    // getUserFriendlyError falls back to status-based suggestions only when the
    // error_code is unknown. With 0, every branch is false, so an unmapped code
    // would produce no suggestion at all — which is why the map entry matters.
    const unmapped = new ServiceError(0, "boom");
    expect(getUserFriendlyError(unmapped).suggestion).toBeUndefined();

    expect(getUserFriendlyError(error).suggestion).toBeDefined();
  });

  it("a real 500 still reports as a server error", () => {
    const serverError = new ServiceError(500, "boom");
    serverError.error_code = "INTERNAL_ERROR";
    expect(getUserFriendlyError(serverError).message).toBe("Server error");
  });
});
