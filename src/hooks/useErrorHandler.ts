/**
 * Centralized error handler hook for React Query mutations and queries.
 * Provides consistent toast notifications and error handling across the app.
 */
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ServiceError } from "@/services/types";
import { getUserFriendlyError, getToastMessage } from "@/lib/error-messages";

interface UseErrorHandlerOptions {
  /** Whether to show toast notification (default: true) */
  showToast?: boolean;
  /** Whether to redirect to login on 401 (default: true) */
  redirectOn401?: boolean;
  /** Custom error message override */
  customMessage?: string;
  /** Custom suggestion override */
  customSuggestion?: string;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { showToast = true, redirectOn401 = true, customMessage, customSuggestion } = options;

  const navigate = useNavigate();

  const handleError = useCallback(
    (error: unknown, context?: string) => {
      // Only handle ServiceError instances
      if (!(error instanceof ServiceError)) {
        console.error("Unexpected error:", error);
        if (showToast) {
          toast.error("An unexpected error occurred", {
            description: "Please try again later or contact support.",
          });
        }
        return;
      }

      const { status, error_code, title, detail, message } = error;

      // Handle 401 - redirect to login
      if (status === 401 && redirectOn401) {
        if (showToast) {
          const friendly = getUserFriendlyError(error);
          toast.error(friendly.message, {
            description: friendly.suggestion,
          });
        }
        // Redirect to login with return path
        navigate({ to: "/login", search: { redirect: window.location.pathname } });
        return;
      }

      // Handle 403 - forbidden
      if (status === 403) {
        if (showToast) {
          const friendly = getUserFriendlyError(error);
          toast.error(friendly.message, {
            description: friendly.suggestion,
          });
        }
        return;
      }

      // Handle 404 - not found
      if (status === 404) {
        if (showToast) {
          const friendly = getUserFriendlyError(error);
          toast.error(friendly.message, {
            description: friendly.suggestion,
          });
        }
        return;
      }

      // Handle 409 - conflict
      if (status === 409) {
        if (showToast) {
          const friendly = getUserFriendlyError(error);
          toast.error(friendly.message, {
            description: friendly.suggestion,
          });
        }
        return;
      }

      // Handle 422 - validation error
      if (status === 422) {
        if (showToast) {
          const friendly = getUserFriendlyError(error);
          toast.error(friendly.message, {
            description: friendly.suggestion,
          });
        }
        return;
      }

      // Handle 5xx - server errors
      if (status >= 500) {
        if (showToast) {
          const friendly = getUserFriendlyError(error);
          toast.error(friendly.message, {
            description: friendly.suggestion,
            action: {
              label: "Retry",
              onClick: () => window.location.reload(),
            },
          });
        }
        return;
      }

      // Generic error handling for other status codes
      if (showToast) {
        const friendly = getUserFriendlyError(error);
        toast.error(customMessage || friendly.message, {
          description: customSuggestion || friendly.suggestion,
        });
      }
    },
    [showToast, redirectOn401, customMessage, customSuggestion, navigate],
  );

  return { handleError };
}

/**
 * Hook for handling form validation errors (422) with inline field errors.
 * Returns a function to parse validation errors and a map of field errors.
 */
export function useFormErrorHandler() {
  const { handleError } = useErrorHandler({ showToast: false });

  const parseValidationErrors = useCallback((error: unknown): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};

    if (error instanceof ServiceError && error.error_code === "VALIDATION_FAILED") {
      // Try to parse field errors from detail
      if (error.detail) {
        // Backend format: "field1: message1, field2: message2"
        const parts = error.detail.split(", ");
        for (const part of parts) {
          const colonIndex = part.indexOf(": ");
          if (colonIndex > 0) {
            const field = part.slice(0, colonIndex);
            const message = part.slice(colonIndex + 2);
            // Convert backend field path to form field name
            const fieldName = field.split(".").pop() || field;
            fieldErrors[fieldName] = message;
          }
        }
      }
    }

    return fieldErrors;
  }, []);

  const getFieldError = useCallback(
    (fieldErrors: Record<string, string>, fieldName: string): string | undefined => {
      return fieldErrors[fieldName];
    },
    [],
  );

  return { handleError, parseValidationErrors, getFieldError };
}

/**
 * Helper to create an onError handler for React Query mutations.
 * Usage: const { handleError } = useErrorHandler(); mutationOptions.onError = createMutationErrorHandler(handleError)
 */
export function createMutationErrorHandler(
  handleError: (error: unknown, context?: string) => void,
) {
  return (error: unknown) => handleError(error);
}

/**
 * Helper to create an onError handler for React Query queries.
 * Deduplicates toasts for the same error within a time window.
 */
export function createQueryErrorHandler(handleError: (error: unknown, context?: string) => void) {
  let lastErrorTime = 0;
  let lastErrorMessage = "";

  return (error: unknown) => {
    const now = Date.now();
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Deduplicate: don't show toast if same error within 5 seconds
    if (now - lastErrorTime < 5000 && errorMessage === lastErrorMessage) {
      return;
    }

    lastErrorTime = now;
    lastErrorMessage = errorMessage;
    handleError(error);
  };
}
