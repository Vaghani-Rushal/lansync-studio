export class AppError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {boolean} retryable
   * @param {"main"|"renderer"|"network"|"filesystem"} source
   * @param {Record<string, unknown>=} details
   */
  constructor(code, message, retryable, source, details = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.retryable = retryable;
    this.source = source;
    this.details = details;
  }
}

export const toErrorPayload = (error) => {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      source: error.source,
      details: error.details
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "Unexpected error",
    retryable: false,
    source: "main",
    details: {}
  };
};
