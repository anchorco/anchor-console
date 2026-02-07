import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Shield, Activity, Database, History as HistoryIcon, Settings, LogOut, AlertCircle, HelpCircle, User, ChevronDown, Building2, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SignInModal from "./SignInModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, workspace, workspaces, isAuthenticated, setCurrentWorkspace } = useAuth();
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
    { 
      href: "/", 
      icon: Activity, 
      label: "Overview",
      description: "Control what your AI agents store. Audit everything."
    },
    { 
      href: "/agents", 
      icon: Shield, 
      label: "Agents",
      description: "Persistent identity for each agent. Govern what they store."
    },
    { 
      href: "/memory", 
      icon: Database, 
      label: "Governed Data",
      description: "Key-value storage with policy enforcement. Every write is checked before storage."
    },
    { 
      href: "/audit", 
      icon: HistoryIcon, 
      label: "Audit Trail",
      description: "Hash-chained, tamper-evident log of every operation. Prove what happened."
    },
    { 
      href: "/settings", 
      icon: Settings, 
      label: "Settings",
      description: "Manage API keys, workspaces, and account settings."
    },
  ];

  // Get current page title and description
  const currentPage = navItems.find(item => item.href === location) || navItems[0];
  const pageTitle = currentPage.label;
  const pageDescription = currentPage.description;

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
        <main className="flex-1 flex flex-col overflow-hidden relative scroll-smooth">
          {/* Top Header Bar - Matches Sidebar Color */}
          <header className="h-16 flex-shrink-0 border-b border-border bg-sidebar flex items-center px-6">
            <div className="flex items-center justify-between w-full">
              {/* Left side - Page title with info tooltip */}
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">
                  {pageTitle}
                </h1>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Page information"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-xs">
                    <p className="text-sm">{pageDescription}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {/* Right side - Actions */}
              <div className="flex items-center gap-3">
                {/* Workspace Switcher */}
                {isAuthenticated && workspaces.length > 1 && (
                  <Select
                    value={workspace?.id || ""}
                    onValueChange={(value) => {
                      const selectedWorkspace = workspaces.find(ws => ws.id === value);
                      if (selectedWorkspace) {
                        setCurrentWorkspace(selectedWorkspace);
                        toast.success(`Switched to ${selectedWorkspace.name}`);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[180px] h-9">
                      <Building2 className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Select workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Help/Documentation Link */}
                <a
                  href="https://docs.getanchor.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Documentation"
                >
                  <HelpCircle className="w-5 h-5" />
                </a>

                {/* GitHub SDKs Link */}
                <a
                  href="https://github.com/anchorco/anchor-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg hover:bg-accent text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  title="Open source SDKs on GitHub"
                >
                  SDK
                </a>

                {/* User Menu */}
                {isAuthenticated && user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary-foreground">
                            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="hidden md:block text-left">
                          <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">{user?.email || ''}</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{user?.name || 'User'}</p>
                          <p className="text-xs text-muted-foreground">{user?.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="flex items-center cursor-pointer">
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <button
                    onClick={() => setIsSignInModalOpen(true)}
                    className="px-4 py-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </header>
          
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="w-full py-8 px-4 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
