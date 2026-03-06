import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Catches React render errors and shows a fallback with Reload so the app
 * doesn't go blank. Use around main content (e.g. in App or AppLayout).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-muted/30 p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className="size-12 text-destructive" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Reload the page to continue. If the problem persists, try clearing this tab’s data or use a fresh session.
          </p>
          <Button onClick={this.handleReload} variant="default">
            Reload page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
