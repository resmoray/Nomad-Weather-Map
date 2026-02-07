interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading weather data..." }: LoadingStateProps) {
  return (
    <div className="status-card status-loading" role="status" aria-live="polite">
      <span className="loader" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
