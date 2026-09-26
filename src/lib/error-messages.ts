/**
 * User-friendly error message mappings for backend error codes.
 * Maps machine-readable error codes to human-readable messages with actionable suggestions.
 */
import { ServiceError } from "@/services/types";

export interface UserFriendlyError {
  message: string;
  suggestion?: string | undefined;
}

const ERROR_MESSAGES: Record<string, UserFriendlyError | undefined> = {
  // Auth errors
  AUTH_TOKEN_MISSING: {
    message: "Authentication required",
    suggestion: "Please provide a valid bearer token in the Authorization header.",
  },
  AUTH_TOKEN_INVALID: {
    message: "Invalid token",
    suggestion: "The token is malformed or tampered. Please log in again.",
  },
  AUTH_TOKEN_EXPIRED: {
    message: "Session expired",
    suggestion: "Please log in again to get a new access token.",
  },
  AUTH_SHARED_TOKEN_INVALID: {
    message: "Invalid shared token",
    suggestion:
      "The provided shared token is incorrect. Please check your credentials and try again.",
  },
  AUTH_FORBIDDEN: {
    message: "Access denied",
    suggestion: "You don't have permission to perform this action.",
  },

  // Not found errors
  JOB_NOT_FOUND: {
    message: "Job not found",
    suggestion:
      "The job may have been deleted or the ID is incorrect. Check the job list and try again.",
  },
  NODE_NOT_FOUND: {
    message: "Node not found",
    suggestion:
      "The node may have been removed from the cluster or the ID is incorrect. Check the node list and try again.",
  },
  METRICS_NOT_FOUND: {
    message: "Metrics not available",
    suggestion:
      "The job or node may not have run yet, or metrics collection failed. Ensure it has started and try again.",
  },
  LOGS_NOT_FOUND: {
    message: "Logs not available",
    suggestion:
      "The job may not have started yet or log collection failed. Ensure the job has started and try again.",
  },

  // Conflict errors
  JOB_NOT_RETRYABLE: {
    message: "Job cannot be retried",
    suggestion: "Only FAILED or CANCELLED jobs can be retried. Check the job status and try again.",
  },
  JOB_NOT_CANCELLABLE: {
    message: "Job cannot be cancelled",
    suggestion:
      "Only RUNNING or PENDING jobs can be cancelled. Check the job status and try again.",
  },
  RESOURCE_CONFLICT: {
    message: "Resource conflict",
    suggestion:
      "A resource with this identifier already exists or there's a concurrency issue. Please try again.",
  },

  // Validation errors
  VALIDATION_FAILED: {
    message: "Invalid request",
    suggestion:
      "Please check your input and try again. All required fields must be provided with valid values.",
  },

  // Server errors
  INTERNAL_ERROR: {
    message: "Server error",
    suggestion: "An unexpected error occurred. Please try again later or contact support.",
  },

  // Service unavailable errors
  SYNCTHING_UNAVAILABLE: {
    message: "Syncthing unavailable",
    suggestion:
      "Syncthing is not configured on the server. Set the SYNCTHING_ROOT environment variable and restart the API server.",
  },
  DATABASE_UNAVAILABLE: {
    message: "Database unavailable",
    suggestion: "Database connection failed. Please try again later or contact support.",
  },
  SHARED_TOKEN_NOT_CONFIGURED: {
    message: "Authentication not configured",
    suggestion:
      "Shared token is not configured on the server. Set the SHARED_TOKEN environment variable and restart the API server.",
  },
  SERVICE_UNAVAILABLE: {
    message: "Service temporarily unavailable",
    suggestion: "The service is currently unavailable. Please try again later.",
  },

  // Job creation errors
  JOB_CREATE_FAILED: {
    message: "Could not submit the job",
    suggestion:
      "The job could not be created. Check that all required fields are filled correctly and try again.",
  },
  JOB_DUPLICATE_NAME: {
    message: "Job name already exists",
    suggestion: "A job with this name already exists. Please use a unique job name.",
  },
  JOB_INVALID_SPEC: {
    message: "Invalid job specification",
    suggestion:
      "The job specification contains invalid values. Check the form fields and YAML preview for errors.",
  },
  JOB_RESOURCE_UNAVAILABLE: {
    message: "Insufficient cluster resources",
    suggestion:
      "The requested resources (GPUs, CPUs, memory) are not available on any node. Try reducing resource requirements or wait for nodes to become available.",
  },

  // Generic not found
  NOT_FOUND: {
    message: "Resource not found",
    suggestion:
      "The requested resource does not exist. It may have been deleted or the ID is incorrect.",
  },
};

/**
 * Transforms a ServiceError into a user-friendly message with actionable suggestion.
 */
export function getUserFriendlyError(error: ServiceError): UserFriendlyError {
  // Map error_code to user-friendly message and suggestion
  if (error.error_code && ERROR_MESSAGES[error.error_code]) {
    return ERROR_MESSAGES[error.error_code]!;
  }

  // Fallback to backend detail or generic message based on status
  let suggestion: string | undefined;
  if (error.status >= 500) {
    suggestion = "Please try again later or contact support.";
  } else if (error.status === 401) {
    suggestion = "Please log in again to continue.";
  } else if (error.status === 403) {
    suggestion = "You don't have permission to perform this action.";
  } else if (error.status === 404) {
    suggestion = "The requested resource was not found.";
  } else if (error.status === 409) {
    suggestion = "There was a conflict with the current state. Please check and try again.";
  } else if (error.status === 422) {
    suggestion = "Please check your input and try again.";
  }

  const defaultError: UserFriendlyError = {
    message: error.detail || error.message || "An error occurred",
    suggestion,
  };

  return defaultError;
}

/**
 * Gets a short display message for toast notifications.
 */
export function getToastMessage(error: ServiceError): string {
  const friendly = getUserFriendlyError(error);
  if (friendly.suggestion) {
    return `${friendly.message}. ${friendly.suggestion}`;
  }
  return friendly.message;
}
