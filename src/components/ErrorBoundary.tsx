import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "./ui";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Captura crashes de render que React Query no puede atrapar (errores fuera de una query). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 max-w-sm">
            Ocurrió un error inesperado en la agenda.
          </div>
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Reintentar
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
