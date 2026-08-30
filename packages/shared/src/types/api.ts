// Matches NYXOR-API-001 §2.1 exactly: response envelope and pagination shape.

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: ApiErrorShape;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}
