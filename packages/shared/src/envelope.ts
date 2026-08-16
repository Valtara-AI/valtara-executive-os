import type { ApiErrorShape, ApiFailure, ApiSuccess } from "./types/api.js";

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data, error: null };
}

export function fail(code: string, message: string, details?: Record<string, unknown>): ApiFailure {
  const error: ApiErrorShape =
    details === undefined ? { code, message } : { code, message, details };
  return { success: false, data: null, error };
}
