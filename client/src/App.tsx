import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Agents from "./pages/Agents";
import Memory from "./pages/Memory";
import Audit from "./pages/Audit";
import Settings from "./pages/Settings";


function Router() {
  const { isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Handle OAuth callback
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const provider = params.get('provider');
    const email = params.get('email');
    const apiKey = params.get('api_key');

    if (error) {
      toast.error(`OAuth sign-in failed: ${error}`);
      // Clean up URL
      window.history.replaceState({}, '', '/');
      return;
    }

    if (provider && email) {
      // OAuth success - store API key if provided
      if (apiKey) {
        // Import and set API key
        import('@/lib/api').then((module) => {
          module.setApiKey(apiKey);
          toast.success(`Signed in with ${provider === 'google' ? 'Google' : 'Apple'}!`);
          // Clean up URL
          window.history.replaceState({}, '', '/');
          // Reload to refresh auth state
          setTimeout(() => {
            window.location.reload();
          }, 100);
        });
      } else {
        toast.error('OAuth sign-in failed: No API key received');
        window.history.replaceState({}, '', '/');
      }
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Always show the console UI, authentication is handled per-page
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/agents"} component={Agents} />
      <Route path={"/memory"} component={Memory} />
      <Route path={"/audit"} component={Audit} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/auth/callback"} component={Home} /> {/* OAuth callback handler */}
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
