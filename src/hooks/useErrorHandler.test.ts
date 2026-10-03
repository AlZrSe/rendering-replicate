/**
 * `useErrorHandler` is the consumer the grooming spec named as the one that must
 * not misread `ServiceError.status === 0` (issue #28). `error-messages.test.ts`
 * pins the *mapping*; this file pins that the hook actually routes an
 * unreachable-backend error through that mapping rather than through its own
 * non-ServiceError fallback.
 *
 * That routing is the whole point. The hook's first branch is
 * `if (!(error instanceof ServiceError))`, which toasts a hardcoded "An
 * unexpected error occurred" and returns. A `status === 0` ServiceError has to
 * skip it and reach the generic handler at the bottom, which reads `error_code`.
 * A future `if (status < 400)`, or a 0 that stops being a ServiceError, breaks
 * exactly here and nowhere else.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { toast } from "sonner";
import { ServiceError } from "@/services/types";
import { useErrorHandler } from "./useErrorHandler";

// Hoisted so the factory below closes over the real spy instead of a
// not-yet-initialised `const`.
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

// The hook navigates on 401. Not under test here, and there is no router
// provider in this file, so the import is replaced outright.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

type HandleError = (error: unknown, context?: string) => void;

/**
 * Render the hook once and hand back its return value.
 *
 * `renderToString` supplies a real React dispatcher, so the hook runs for real
 * rather than being invoked outside React (which throws). Nothing is asserted
 * about the markup — the subject is the closure, captured during render.
 */
function renderUseErrorHandler(options?: Parameters<typeof useErrorHandler>[0]): {
  handleError: HandleError;
} {
  let captured: { handleError: HandleError } | undefined;

  function Probe() {
    captured = useErrorHandler(options);
    return null;
  }

  renderToString(createElement(Probe));

  if (!captured) throw new Error("Probe did not render");
  return captured;
}

/** Exactly what http.ts throws when no HTTP response was produced. */
function unreachableError(): ServiceError {
  return new ServiceError(0, "GET /jobs failed: backend unreachable", {
    status: 0,
    title: "Backend unreachable",
    detail: "Failed to fetch",
    instance: "/jobs",
    error_code: "BACKEND_UNREACHABLE",
  });
}

/** The first `toast.error(message, options)` call, or a loud failure. */
function firstToastCall(): { message: string; options: Record<string, unknown> } {
  const call = vi.mocked(toast.error).mock.calls[0];
  if (!call) throw new Error("toast.error was never called");
  return { message: String(call[0]), options: (call[1] ?? {}) as Record<string, unknown> };
}

describe("useErrorHandler with ServiceError.status === 0", () => {
  it("takes the ServiceError branch and toasts the connection message", () => {
    renderUseErrorHandler().handleError(unreachableError());

    expect(toast.error).toHaveBeenCalledOnce();
    const { message, options } = firstToastCall();

    // The connection message from the BACKEND_UNREACHABLE map entry...
    expect(message).toBe("Cannot reach the cluster backend");
    expect(options.description).toContain("backend is running");
    // ...and explicitly not the non-ServiceError fallback, which would mean the
    // hook had stopped recognising the error it was handed.
    expect(message).not.toBe("An unexpected error occurred");
    expect(options.description).not.toBe("Please try again later or contact support.");
    // The raw `detail` ("Failed to fetch") is for logs, not for the user.
    expect(options.description).not.toContain("Failed to fetch");
  });

  it("misses the 5xx and 401 branches: no Retry action, no redirect", () => {
    renderUseErrorHandler().handleError(unreachableError());

    const { options } = firstToastCall();

    // `action` is only attached by the `status >= 500` branch.
    expect(options.action).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});
