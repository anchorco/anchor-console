import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, User, setApiKey, clearApiKey, getApiKey, getApiKeyId, getWorkspaceId, setWorkspaceId, ApiKey } from '@/lib/api';
import { workspaces, Workspace } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  apiKeys: ApiKey[]; // API keys from login response
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspacesList, setWorkspacesList] = useState<Workspace[]>([]);
  const [apiKeysList, setApiKeysList] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Retry auth check if it failed but we have an API key (network errors)
  useEffect(() => {
    const apiKey = getApiKey();
    if (apiKey && !user && !isLoading && retryCount < 2) {
      // We have an API key but no user - might be a network error, retry
      const retryTimeout = setTimeout(() => {
        console.log('[Auth] Retrying auth check (attempt', retryCount + 1, ')...');
        setRetryCount(prev => prev + 1);
        checkAuth();
      }, 2000);
      return () => clearTimeout(retryTimeout);
    }
  }, [user, isLoading, retryCount]);

  async function checkAuth() {
    try {
      // First check for API key (for programmatic access)
      const apiKey = getApiKey();
      if (apiKey) {
        // Try to get current user - this validates the API key
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000) // Increased timeout
        );
        
        try {
          const response = await Promise.race([
            auth.getCurrentUser(),
            timeoutPromise
          ]) as any;
          
          setUser(response.user);

          // Load workspaces
          await loadWorkspaces();
          setIsLoading(false);
          return;
        } catch (requestError: any) {
          // If request fails but we have an API key, check if it's a network error vs auth error
          const errorMessage = requestError instanceof Error ? requestError.message : String(requestError);
          const isAuthError = errorMessage.includes('401') || 
                             errorMessage.includes('403') ||
                             errorMessage.includes('Unauthorized') ||
                             errorMessage.includes('Invalid or expired API key') ||
                             errorMessage.includes('API key required');
          
          if (isAuthError) {
            // API key is invalid - clear it
            console.error('[Auth] API key is invalid:', requestError);
            clearApiKey();
            setUser(null);
            setIsLoading(false);
            return;
          } else {
            // Network error or timeout - API key might still be valid
            // Don't clear user state or API key, just log the error
            console.warn('[Auth] Network error during auth check, but API key exists. User may need to retry:', errorMessage);
            // Don't clear anything - keep API key and let user retry
            // User state will remain null until successful auth check
            setIsLoading(false);
            return;
          }
        }
      }

      // If no API key, check for OAuth session cookie
      // The backend will validate the session cookie when we try to get user info
      // For now, if there's no API key, user is not authenticated
      // OAuth sessions will be handled via cookie-based auth in future
      setIsLoading(false);
    } catch (error) {
      console.error('Auth check failed:', error);
      // Don't clear API key on unexpected errors - might be network issue
      setIsLoading(false);
    }
  }

  async function loadWorkspaces() {
    try {
      // Workspace is now handled automatically by the API based on the API key
      // We still try to load workspaces for backward compatibility, but it's not required
      const response = await workspaces.list();
      setWorkspacesList(response.workspaces || []);

      // Set current workspace if we have one stored (for backward compatibility)
      const storedWorkspaceId = getWorkspaceId();
      if (storedWorkspaceId && response.workspaces) {
        const found = response.workspaces.find(w => w.id === storedWorkspaceId);
        if (found) {
          setWorkspace(found);
          setWorkspaceId(found.id);
        } else if (response.workspaces.length > 0) {
          // Stored workspace not found, use first available
          setWorkspace(response.workspaces[0]);
          setWorkspaceId(response.workspaces[0].id);
        }
      } else if (response.workspaces && response.workspaces.length > 0) {
        // No stored workspace, use first available
        setWorkspace(response.workspaces[0]);
        setWorkspaceId(response.workspaces[0].id);
      }
    } catch (error) {
      // Workspace loading is optional - API handles workspace automatically
      // Don't show errors, just log for debugging
      console.log('[Auth] Workspace loading skipped (workspace is handled automatically by API):', error);
      setWorkspacesList([]);
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await auth.login({ email, password });
      setUser(response.user);

      // If user has workspaces, load them
      if (response.workspaces && response.workspaces.length > 0) {
        setWorkspacesList(response.workspaces);
        // Use the workspace from response or first one
        const defaultWorkspace = response.workspace || response.workspaces[0];
        setWorkspace(defaultWorkspace);
        setWorkspaceId(defaultWorkspace.id);
      } else {
        // Load workspaces separately
        await loadWorkspaces();
      }

      // Store API keys from response (so they're visible even if we can't load them via API)
      if (response.apiKeys && response.apiKeys.length > 0) {
        setApiKeysList(response.apiKeys);
      }

      // Ensure there's always an active API key for console operations
      // Priority: stored key > new key from login
      const storedKey = getApiKey();
      const storedKeyId = getApiKeyId();
      
      if (storedKey && storedKeyId) {
        // Check if stored key matches one of the user's keys
        const storedKeyExists = response.apiKeys?.some(key => key.id === storedKeyId);
        if (storedKeyExists) {
          // Stored key matches one of user's keys, use it
          console.log('[Auth] Using stored API key as active key (matches user\'s keys)');
        } else {
          // Stored key doesn't match user's keys, clear it and use new key
          console.log('[Auth] Stored key doesn\'t match user\'s keys, clearing and using new key');
          clearApiKey();
          if (response.apiKey && response.key) {
            setApiKey(response.key, response.apiKey.id);
            console.log('[Auth] Console Key activated from login');
          }
        }
      } else if (response.apiKey && response.key) {
        // No stored key - activate the new key from login
        setApiKey(response.key, response.apiKey.id);
        console.log('[Auth] Console Key activated from login');
      } else {
        // No stored key and no new key returned
        // User has existing keys but we can't return plain keys
        // They can use session-based auth or activate a key in Settings
        console.log('[Auth] Login successful - use session-based auth or activate a key in Settings');
      }
      
      // Refresh auth state in the background (don't block)
      checkAuth().catch(() => {
        // Suppress errors - validation happens in background
        console.log('[Auth] Background auth check completed');
      });
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  }

  async function signup(email: string, password: string, name?: string) {
    try {
      const response = await auth.signup({ email, password, name });
      
      // Set user from response
      setUser(response.user);
      
      // Store the API key if provided (only returned once on signup)
      if (response.key && response.apiKey) {
        setApiKey(response.key, response.apiKey.id);
        console.log('[Auth] API key stored from signup');
      }
      
      // Set workspace if provided
      if (response.workspace) {
        setWorkspacesList([response.workspace]);
        setWorkspace(response.workspace);
        setWorkspaceId(response.workspace.id);
      }
      
      // Refresh auth state to validate the API key
      await checkAuth();
    } catch (error: any) {
      throw new Error(error.message || 'Signup failed');
    }
  }

  async function logout() {
    try {
      // Call backend logout to clear session cookie
      await auth.logout();
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      // Continue with local cleanup even if backend call fails
    }
    clearApiKey();
    setUser(null);
    setWorkspace(null);
    setWorkspacesList([]);
    setApiKeysList([]);
  }

  function setCurrentWorkspace(ws: Workspace) {
    setWorkspace(ws);
    setWorkspaceId(ws.id);
  }

  async function refreshWorkspaces() {
    await loadWorkspaces();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        workspaces: workspacesList,
        apiKeys: apiKeysList,
        isLoading,
        isAuthenticated: !!user, // User is authenticated if they have a user object (API key needed for API calls, not UI access)
        login,
        signup,
        logout,
        setCurrentWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

