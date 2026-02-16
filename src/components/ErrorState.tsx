import { memo } from "react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState = memo(function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="status-card status-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
});
