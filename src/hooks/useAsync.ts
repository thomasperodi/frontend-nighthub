import { useState, useEffect, useCallback, useRef } from 'react';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Generic hook for data fetching with loading/error states
 * Handles cleanup on unmount and provides refetch capability
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  options?: {
    immediate?: boolean; // fetch immediately on mount (default: true)
    deps?: any[]; // dependencies to trigger refetch
    onSuccess?: (data: T) => void;
    onError?: (error: unknown) => void;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options?.immediate !== false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await asyncFn();
      
      if (isMountedRef.current) {
        setData(result);
        options?.onSuccess?.(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message = ErrorHandler.getMessage(err);
        setError(message);
        ErrorHandler.log(err);
        options?.onError?.(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [asyncFn, options?.onSuccess, options?.onError]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (options?.immediate !== false) {
      execute();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, options?.deps || []);

  return {
    data,
    loading,
    error,
    refetch: execute,
    setData, // allow manual data updates
  };
}

/**
 * Hook variant that only executes when explicitly called
 */
export function useLazyAsync<T, Args extends any[]>(
  asyncFn: (...args: Args) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: unknown) => void;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: Args) => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await asyncFn(...args);
        
        if (isMountedRef.current) {
          setData(result);
          options?.onSuccess?.(result);
        }
        
        return result;
      } catch (err) {
        if (isMountedRef.current) {
          const message = ErrorHandler.getMessage(err);
          setError(message);
          ErrorHandler.log(err);
          options?.onError?.(err);
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [asyncFn, options?.onSuccess, options?.onError]
  );

  return {
    data,
    loading,
    error,
    execute,
    setData,
  };
}
