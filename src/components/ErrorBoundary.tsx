import { Component, type ReactNode } from "react";
import { ErrorState } from "./ErrorState";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: getErrorMessage(error),
    };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    // Keep logs for debugging; the UI stays resilient.
    console.error("ErrorBoundary caught error", error, info);
  }

  render() {
    if (this.state.hasError) {
      const details = import.meta.env.DEV && this.state.message ? ` (${this.state.message})` : "";
      return (
        <ErrorState
          message={`Something went wrong while rendering the app.${details}`}
          onRetry={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}
