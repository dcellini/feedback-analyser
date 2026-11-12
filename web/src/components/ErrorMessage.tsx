import type { ApiError } from "../api/client";

/**
 * CHAPTER 9 — ONE WAY TO SHOW ERRORS
 *
 * Because the API always returns { error: { code, message } } and the
 * client turns every failure into an ApiError, the whole UI can show
 * errors with this one component.
 *
 * role="alert" makes screen readers announce the error immediately.
 */
interface ErrorMessageProps {
  error: ApiError;
  onRetry?: () => void;
}

export const ErrorMessage = ({ error, onRetry }: ErrorMessageProps) => (
  <div className="error" role="alert">
    <p>{error.message}</p>
    {onRetry && (
      <button type="button" className="button-secondary" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);
