import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Shield, Activity, Database, History as HistoryIcon, Settings, LogOut, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SignInModal from "./SignInModal";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, workspace, isAuthenticated } = useAuth();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [intendedDestination, setIntendedDestination] = useState<string | null>(null);

  function handleLogout() {
    logout();
    toast.success('Logged out successfully');
    // Redirect to home page if not already there
    if (location !== '/') {
      setLocation('/');
    }
  }

  function handleNavClick(e: React.MouseEvent, href: string) {
    // If not authenticated and trying to access Settings, show sign-in modal
    if (!isAuthenticated && href === '/settings') {
      e.preventDefault();
      setIsSignInModalOpen(true);
      // Store the intended destination for redirect after login
      setIntendedDestination(href);
    }
    // Allow navigation to all other pages - they'll show mock data if not authenticated
    // Actions on pages will require authentication and show sign-in modal
  }

  const navItems = [
    { href: "/", icon: Activity, label: "Overview" },
    { href: "/agents", icon: Shield, label: "Agents" },
    { href: "/memory", icon: Database, label: "Governed Data" },
    { href: "/audit", icon: HistoryIcon, label: "Audit Trail" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-20 lg:w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-border">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                <img 
                  src="/anchor-logo.jpg" 
                  alt="Anchor Logo" 
                  className="w-8 h-8 object-contain rounded-md"
                />
                <span className="hidden lg:block font-semibold text-lg text-foreground">
                  Anchor
                </span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 py-6 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const requiresAuth = item.href !== '/';
              return (
                <Link key={item.href} href={item.href} onClick={(e) => handleNavClick(e, item.href)}>
                  <div
                    className={cn(
                      "flex items-center px-3 py-2.5 rounded-lg transition-colors duration-150 group cursor-pointer",
                      isActive
                        ? "bg-primary/10 text-primary border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      !isAuthenticated && requiresAuth && "opacity-60"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "w-5 h-5 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="hidden lg:block ml-3 font-medium text-sm">
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border space-y-2">
            {isAuthenticated && workspace && (
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Workspace</p>
                <p className="text-sm font-medium text-foreground truncate">{workspace.name}</p>
              </div>
            )}
            <div className="bg-card border border-border rounded-lg p-3">
              {isAuthenticated ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary-foreground">
                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="hidden lg:block overflow-hidden flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Not signed in</p>
                    <button
                      onClick={() => setIsSignInModalOpen(true)}
                      className="text-xs text-primary hover:underline mt-0.5"
                    >
                      Sign in to continue
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Sign In Modal */}
          <SignInModal 
            isOpen={isSignInModalOpen} 
            onClose={() => {
              setIsSignInModalOpen(false);
              setIntendedDestination(null);
            }}
            redirectTo={intendedDestination || undefined}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
          <div className="container mx-auto py-8 px-4 lg:px-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
