import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./button";
import { Card, CardContent } from "./card";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-4">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="mb-2 text-xl font-bold text-red-600">
                  Something went wrong
                </h2>
                <p className="mb-4 text-sm text-gray-600">
                  An unexpected error occurred. Please try refreshing the page.
                </p>
                {this.state.error && (
                  <p className="mb-4 rounded bg-gray-100 p-2 text-xs text-red-500">
                    {this.state.error.message}
                  </p>
                )}
                <Button onClick={this.handleReload}>Reload Page</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
