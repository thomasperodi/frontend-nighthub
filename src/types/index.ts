// Centralized exports for all types
export * from './admin';
export * from './events';
export * from './reservations';
export * from './users';
export * from './tables';

// Common API response types
export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
};

export type ApiError = {
  message: string;
  statusCode: number;
  error?: string;
  details?: any;
};

// Common loading/error state
export type DataState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};
