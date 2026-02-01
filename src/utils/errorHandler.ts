import { AxiosError } from 'axios';
import { Alert } from 'react-native';
import { ApiError } from '../types';

/**
 * Centralized error handler for API calls
 */
export class ErrorHandler {
  /**
   * Extract error message from various error types
   */
  static extractMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      // Network error
      if (!error.response) {
        return 'Errore di rete: impossibile connettersi al server. Verifica la connessione.';
      }

      // API error response
      const apiError = error.response?.data as ApiError | undefined;
      if (apiError?.message) {
        return apiError.message;
      }

      // HTTP status error
      switch (error.response?.status) {
        case 400:
          return 'Richiesta non valida. Verifica i dati inseriti.';
        case 401:
          return 'Sessione scaduta. Effettua nuovamente il login.';
        case 403:
          return 'Non hai i permessi per eseguire questa operazione.';
        case 404:
          return 'Risorsa non trovata.';
        case 409:
          return 'Conflitto: la risorsa esiste già o non può essere modificata.';
        case 422:
          return 'Dati non validi. Controlla i campi inseriti.';
        case 500:
          return 'Errore del server. Riprova più tardi.';
        case 503:
          return 'Servizio temporaneamente non disponibile. Riprova tra poco.';
        default:
          return `Errore del server (${error.response?.status})`;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Si è verificato un errore imprevisto.';
  }

  /**
   * Handle error and show Alert (use this for critical errors)
   */
  static showError(error: unknown, title: string = 'Errore') {
    const message = this.extractMessage(error);
    Alert.alert(title, message);
  }

  /**
   * Handle error silently (just return message for manual display)
   */
  static getMessage(error: unknown): string {
    return this.extractMessage(error);
  }

  /**
   * Log error to console (development only)
   */
  static log(error: unknown, context?: string) {
    if (__DEV__) {
      console.error(`[ErrorHandler${context ? ` - ${context}` : ''}]:`, error);
      if (error instanceof AxiosError) {
        console.error('Response data:', error.response?.data);
        console.error('Request config:', error.config);
      }
    }
  }

  /**
   * Check if error is authentication related
   */
  static isAuthError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      return error.response?.status === 401;
    }
    return false;
  }

  /**
   * Check if error is network related
   */
  static isNetworkError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      return !error.response;
    }
    return false;
  }
}

/**
 * Utility to wrap async functions with error handling
 */
export async function handleAsync<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (error: unknown) => void;
    showAlert?: boolean;
    context?: string;
  }
): Promise<[T | null, unknown]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    ErrorHandler.log(error, options?.context);
    
    if (options?.showAlert) {
      ErrorHandler.showError(error);
    }
    
    if (options?.onError) {
      options.onError(error);
    }
    
    return [null, error];
  }
}
