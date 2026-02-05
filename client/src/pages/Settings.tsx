import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Key, Bell, User, Save, Plus, Trash2, Copy, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiKeys, ApiKey, CreateApiKeyRequest, setApiKey, getApiKey, getApiKeyId, API_BASE_URL, auth } from "@/lib/api";
import { workspaces, Workspace } from "@/lib/api";
import { toast } from "sonner";
import { useLocation } from "wouter";
import SignInModal from "@/components/SignInModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
  const { user, workspace, workspaces: workspacesList, apiKeys: apiKeysFromAuth, setCurrentWorkspace, refreshWorkspaces, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"profile" | "api-keys" | "workspaces" | "security">("profile");

  // Redirect to home if user becomes unauthenticated while on settings page
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  // Update profile name when user changes
  useEffect(() => {
    setProfileName(user?.name || "");
  }, [user?.name]);
  const [apiKeysList, setApiKeysList] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyToActivate, setKeyToActivate] = useState("");
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [activatingKeyId, setActivatingKeyId] = useState<string | null>(null);
  const [emailForApiKey, setEmailForApiKey] = useState("");
  const [profileName, setProfileName] = useState(user?.name || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (isAuthenticated && activeTab === "api-keys") {
      // First try to use API keys from auth context (from login response)
      if (apiKeysFromAuth && apiKeysFromAuth.length > 0) {
        setApiKeysList(apiKeysFromAuth);
      }
      // Then try to load from API (will update the list if successful)
      loadApiKeys();
    }
  }, [activeTab, isAuthenticated, apiKeysFromAuth]);

  async function loadApiKeys() {
    try {
      setIsLoadingKeys(true);
      const response = await apiKeys.list();
      setApiKeysList(response.apiKeys);
    } catch (error: any) {
      // If error is "API key required" and user is authenticated, they just need to create/activate a key
      // Don't show error toast - just show empty state with create button
      if (error.message && error.message.includes('API key required') && isAuthenticated) {
        console.log('[Settings] No valid API key stored, but user is authenticated');
        setApiKeysList([]);
      } else {
        toast.error(error.message || "Failed to load API keys");
      }
    } finally {
      setIsLoadingKeys(false);
    }
  }

  async function handleCreateApiKey() {
    // Allow creating API key even when not authenticated (backend supports email-only creation)
    // Get email from user object (if authenticated) or from form input
    let emailToUse = user?.email || emailForApiKey.trim();
    
    if (!emailToUse) {
      // If not authenticated and no email provided, show error
      if (!isAuthenticated) {
        toast.error("Please enter your email address");
        return;
      }
      toast.error("User email not found");
      return;
    }

    try {
      const request: CreateApiKeyRequest = {
        email: emailToUse,
        name: newKeyName || undefined,
      };
      const response = await apiKeys.create(request);
      setCreatedKey(response.key);
      // Store the API key for authentication (with key ID)
      setApiKey(response.key, response.apiKey.id);
      setNewKeyName("");
      setEmailForApiKey(""); // Clear email input
      setIsCreateKeyOpen(false);
      
      // Wait a moment for the API key to be stored, then load API keys
      // This will now work because we just stored a valid API key
      setTimeout(() => {
        loadApiKeys();
      }, 100);
      
      // Don't show toast or reload - let the user copy the key first
      // The dialog will show the key and they can copy it
    } catch (error: any) {
      toast.error(error.message || "Failed to create API key");
    }
  }

  async function handleRevokeApiKey(id: string) {
    if (!isAuthenticated) {
      setIsSignInModalOpen(true);
      return;
    }
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }

    try {
      await apiKeys.revoke(id);
      toast.success("API key revoked");
      loadApiKeys();
    } catch (error: any) {
      toast.error(error.message || "Failed to revoke API key");
    }
  }

  function handleKeyClick(keyId: string) {
    const storedKeyId = getApiKeyId();
    if (storedKeyId === keyId) {
      // Already active, do nothing
      return;
    }
    // Open dialog to paste the key for this specific key ID
    setActivatingKeyId(keyId);
    setKeyToActivate("");
  }

  async function handleActivateKey() {
    if (!keyToActivate.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    if (!activatingKeyId) {
      toast.error("No key selected");
      return;
    }

    setIsValidatingKey(true);
    try {
      // Validate the API key by calling /auth/me with it
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'X-API-Key': keyToActivate.trim(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error("Invalid API key");
      }

      const data = await response.json();
      
      // Verify the key ID matches the one we're trying to activate
      if (data.apiKeyId !== activatingKeyId) {
        throw new Error("This key does not match the selected API key. Please paste the correct key.");
      }
      
      // Store the key and its ID
      setApiKey(keyToActivate.trim(), data.apiKeyId);
      
      toast.success("API key activated! Console will now use this key.");
      setKeyToActivate("");
      setActivatingKeyId(null);
      loadApiKeys();
      
      // Refresh auth state
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to validate API key. Please check and try again.");
    } finally {
      setIsValidatingKey(false);
    }
  }

  async function handleCreateWorkspace() {
    if (!isAuthenticated) {
      setIsSignInModalOpen(true);
      return;
    }
    if (!newWorkspaceName.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    try {
      await workspaces.create({ name: newWorkspaceName });
      toast.success("Workspace created");
      setNewWorkspaceName("");
      setIsCreateWorkspaceOpen(false);
      await refreshWorkspaces();
    } catch (error: any) {
      toast.error(error.message || "Failed to create workspace");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const tabs = [
    { id: "profile" as const, icon: User, label: "Profile" },
    { id: "api-keys" as const, icon: Key, label: "API Keys" },
    // Workspaces tab removed - workspace is now handled automatically by the API
    { id: "security" as const, icon: Shield, label: "Security" },
  ];

  // Show sign-in modal when trying to perform actions if not authenticated
  function handleAction(action: () => void) {
    if (!isAuthenticated) {
      setIsSignInModalOpen(true);
    } else {
      action();
    }
  }

  async function handleSaveProfile() {
    if (!isAuthenticated) {
      setIsSignInModalOpen(true);
      return;
    }

    // Check if we have an API key stored
    const apiKey = getApiKey();
    if (!apiKey) {
      // If authenticated but no API key stored, this should have been handled on login
      // But if it wasn't, show helpful error
      toast.error("API key required. Please create or activate an API key in the API Keys tab.");
      setActiveTab("api-keys");
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await auth.updateUser({ name: profileName.trim() || undefined });
      // Update user in auth context - we need to refresh user data
      toast.success("Profile updated successfully");
      // Reload to refresh user data
      window.location.reload();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to update profile";
      if (errorMessage.includes('API key required') || errorMessage.includes('Unauthorized')) {
        toast.error("API key invalid. Please activate a valid API key in the API Keys tab.");
        setActiveTab("api-keys");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
            Settings
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage API keys, workspaces, and account settings.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  activeTab === tab.id
                    ? "bg-primary/20 text-primary border border-primary/20 shadow-[0_0_15px_-5px_var(--primary)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <Card className="glass-panel border-0">
                <CardHeader>
                  <CardTitle className="text-white">Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white">Full Name</Label>
                      <Input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="bg-black/20 border-white/10 text-white"
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">Email Address</Label>
                      <Input
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="bg-black/20 border-white/10 text-white opacity-50"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isSavingProfile ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" /> Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* API Keys Tab */}
            {activeTab === "api-keys" && (
              <>
                <Card className="glass-panel border-0">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white">API Keys</CardTitle>
                    <Dialog open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90">
                          <Plus className="w-4 h-4 mr-2" /> Create API Key
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass-panel border-white/10">
                        <DialogHeader>
                          <DialogTitle className="text-white">Create API Key</DialogTitle>
                          <DialogDescription className="text-muted-foreground">
                            {!isAuthenticated 
                              ? "Enter your email to create a new API key. You'll need to sign in if you want to manage it later."
                              : "Create a new API key for authenticating with the Anchor API."}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {!isAuthenticated && (
                            <div>
                              <Label htmlFor="emailForApiKey" className="text-white">Email</Label>
                              <Input
                                id="emailForApiKey"
                                type="email"
                                value={emailForApiKey}
                                onChange={(e) => setEmailForApiKey(e.target.value)}
                                placeholder="your@email.com"
                                className="bg-black/20 border-white/10 text-white"
                                required
                              />
                            </div>
                          )}
                          <div>
                            <Label htmlFor="keyName" className="text-white">Key Name (optional)</Label>
                            <Input
                              id="keyName"
                              value={newKeyName}
                              onChange={(e) => setNewKeyName(e.target.value)}
                              placeholder="My API Key"
                              className="bg-black/20 border-white/10 text-white"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setIsCreateKeyOpen(false)}
                              className="border-white/10"
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleCreateApiKey} className="bg-primary hover:bg-primary/90">
                              Create
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {!isAuthenticated ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p>Sign in to view and manage your API keys.</p>
                      </div>
                    ) : isLoadingKeys ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : apiKeysList.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No API keys found. Create one to get started.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {apiKeysList.length > 0 && (
                          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              <Key className="w-4 h-4 inline mr-2" />
                              You have {apiKeysList.length} API key{apiKeysList.length !== 1 ? 's' : ''}. 
                              All keys work for API calls from your code. 
                              The key marked "Active (Console)" is used for console operations in this browser.
                            </p>
                          </div>
                        )}
                        {apiKeysList.map((key) => {
                          const storedKeyId = getApiKeyId();
                          const isActive = storedKeyId === key.id;
                          return (
                            <div
                              key={key.id}
                              className={`glass-card p-4 rounded-lg flex items-center justify-between ${
                                !isActive ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''
                              }`}
                              onClick={() => !isActive && handleKeyClick(key.id)}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-white">{key.name || "Unnamed Key"}</p>
                                  {isActive && (
                                    <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                                      Active (Console)
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Created: {new Date(key.createdAt).toLocaleDateString()}
                                  {key.lastUsedAt && ` • Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                                </p>
                                {!isActive && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Click to switch console to use this key.
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {!isActive && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent triggering the card click
                                      handleKeyClick(key.id);
                                    }}
                                    className="border-primary/20 text-primary hover:bg-primary/10"
                                  >
                                    Switch to This Key
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent triggering the card click
                                    handleRevokeApiKey(key.id);
                                  }}
                                  className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                                  disabled={apiKeysList.length === 1 || isActive} // Prevent revoking last key or active key
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Revoke
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Activate Key Dialog */}
                <Dialog open={activatingKeyId !== null} onOpenChange={(open) => {
                  if (!open) {
                    setActivatingKeyId(null);
                    setKeyToActivate("");
                  }
                }}>
                  <DialogContent className="glass-panel border-white/10">
                    <DialogHeader>
                      <DialogTitle className="text-white">Switch to This API Key</DialogTitle>
                      <DialogDescription className="text-muted-foreground">
                        Paste the API key value to switch the console to use this key. You'll need the full key value (starts with "anc_sk_").
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="activateKey" className="text-white">API Key</Label>
                        <Input
                          id="activateKey"
                          type="password"
                          value={keyToActivate}
                          onChange={(e) => setKeyToActivate(e.target.value)}
                          placeholder="anc_sk_..."
                          className="bg-black/20 border-white/10 text-white font-mono"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isValidatingKey) {
                              handleActivateKey();
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setActivatingKeyId(null);
                            setKeyToActivate("");
                          }}
                          className="border-white/10"
                          disabled={isValidatingKey}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleActivateKey} 
                          className="bg-primary hover:bg-primary/90"
                          disabled={isValidatingKey}
                        >
                          {isValidatingKey ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validating...
                            </>
                          ) : (
                            "Activate"
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Show created key modal */}
                {createdKey && (
                  <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
                    <DialogContent className="glass-panel border-white/10">
                      <DialogHeader>
                        <DialogTitle className="text-white">API Key Created</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                          Save this key now! You won't be able to see it again.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded-lg border border-white/10">
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-sm font-mono text-white break-all">{createdKey}</code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(createdKey)}
                              className="border-white/10"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            setCreatedKey(null);
                            // Reload after user confirms they've saved the key
                            toast.success("API key saved! Console will now use this key.");
                            setTimeout(() => {
                              window.location.reload();
                            }, 500);
                          }}
                          className="w-full bg-primary hover:bg-primary/90"
                        >
                          I've Saved It
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}

            {/* Workspaces Tab - Removed: Workspace is now handled automatically by the API */}

            {/* Security Tab */}
            {activeTab === "security" && (
              <Card className="glass-panel border-0">
                <CardHeader>
                  <CardTitle className="text-white">Security Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Two-Factor Authentication</h4>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                      </div>
                    </div>
                    <Button variant="outline" className="border-white/10">
                      Enable
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Sign In Modal */}
          <SignInModal 
            isOpen={isSignInModalOpen} 
            onClose={() => setIsSignInModalOpen(false)}
            redirectTo="/settings"
          />
      </div>
    </Layout>
  );
}
