import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ShieldAlert, ShieldCheck, MoreVertical, Bot, Zap, Database, Plus, Plus as PlusIcon, Loader2, AlertCircle, X, Trash2, Pencil, Save, History as HistoryIcon, ExternalLink, Copy, Check } from "lucide-react";
import { agents, Agent, getApiKey } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import SignInModal from "@/components/SignInModal";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Agents() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [agentsList, setAgentsList] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isAgentDetailOpen, setIsAgentDetailOpen] = useState(false);
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    owner: "",
    team: "",
    tags: [] as string[],
  });
  const [editMetadataText, setEditMetadataText] = useState("{}");
  const [editPolicies, setEditPolicies] = useState({
    block_pii: false,
    block_secrets: false,
    retention_days: undefined as number | undefined,
  });
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    owner: "",
    tags: [] as string[],
    metadata: {} as Record<string, any>,
  });
  const [metadataText, setMetadataText] = useState("{}");
  const [newTag, setNewTag] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null);

  function copyAgentId(agentId: string) {
    navigator.clipboard.writeText(agentId).then(() => {
      setCopiedAgentId(agentId);
      toast.success('Agent ID copied to clipboard');
      setTimeout(() => setCopiedAgentId(null), 2000);
    }).catch(() => {
      toast.error('Failed to copy Agent ID');
    });
  }

  // Function to get robot color based on agent_id for consistency
  function getRobotColor(agentId: string) {
    const colors = [
      { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-500' },
      { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-500' },
      { bg: 'bg-pink-500/10', border: 'border-pink-500/20', icon: 'text-pink-500' },
      { bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: 'text-orange-500' },
      { bg: 'bg-green-500/10', border: 'border-green-500/20', icon: 'text-green-500' },
      { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: 'text-cyan-500' },
      { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', icon: 'text-indigo-500' },
      { bg: 'bg-teal-500/10', border: 'border-teal-500/20', icon: 'text-teal-500' },
    ];
    const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  useEffect(() => {
    if (isAuthenticated) {
      // Check for API key with a small delay to allow it to be stored after login
      const checkAndLoad = () => {
        const apiKey = getApiKey();
        if (apiKey) {
          loadAgents();
          return true;
        }
        return false;
      };

      // Check immediately
      if (!checkAndLoad()) {
        // If no API key, check again after a short delay (API key might be stored asynchronously)
        const timeoutId = setTimeout(() => {
          if (!checkAndLoad()) {
            // Still no API key - clear agents list (will show empty state)
            setAgentsList([]);
          }
        }, 500);
        return () => clearTimeout(timeoutId);
      }
    } else {
      // Show mock agents when not authenticated
      setAgentsList([
        {
          agent_id: "agent_demo_1",
          name: "Customer Support Bot",
          status: "active",
          description: "Handles customer inquiries and support tickets",
          config: {
            policies: {
              block_pii: true,
              block_secrets: true,
              retention_days: 90
            }
          },
          version: "1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          agent_id: "agent_demo_2",
          name: "Sales Agent",
          status: "active",
          description: "Manages sales conversations and lead qualification",
          config: {
            policies: {
              block_pii: true,
              retention_days: 60
            }
          },
          version: "1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          agent_id: "agent_demo_3",
          name: "Dev Bot",
          status: "suspended",
          description: "Development and testing agent",
          config: {
            policies: {
              block_secrets: true
            }
          },
          version: "1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ] as Agent[]);
    }
  }, [isAuthenticated]);

  // Watch for API key storage events (when API key is set after login)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'apiKey' && e.newValue) {
        // API key was just stored, reload agents
        loadAgents();
      }
    };

    // Listen for storage events (when API key is set in another tab/window)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event (when API key is set in same window)
    const handleCustomStorage = () => {
      const apiKey = getApiKey();
      if (apiKey) {
        // API key was just stored, reload agents to replace mock data
        loadAgents();
      }
    };
    window.addEventListener('apiKeyStored', handleCustomStorage);

    // Also check periodically in case the event doesn't fire (fallback)
    const intervalId = setInterval(() => {
      const apiKey = getApiKey();
      // Check if we have an API key but are still showing mock data (demo agents)
      if (apiKey && agentsList.some(agent => agent.agent_id.startsWith('agent_demo_'))) {
        loadAgents();
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('apiKeyStored', handleCustomStorage);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, agentsList]);

  async function loadAgents() {
    try {
      setIsLoading(true);
      const response = await agents.list({ limit: 100 });
      setAgentsList(response.data || []);
    } catch (error: any) {
      // Don't show error if it's just a missing API key - user may need to activate one
      if (error.message && error.message.includes('API key required')) {
        console.log('[Agents] API key not available yet - user may need to activate one');
        return;
      }
      toast.error(error.message || "Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateAgent() {
    if (!createForm.name.trim()) {
      toast.error("Agent name is required");
      return;
    }

    // Validate metadata JSON before submitting
    let metadata = createForm.metadata;
    try {
      const parsed = JSON.parse(metadataText || "{}");
      metadata = parsed;
    } catch (error) {
      toast.error("Invalid JSON in metadata field. Please fix the syntax.");
      return;
    }

    try {
      // Map metadata to config for backend compatibility
      // The documented API uses 'metadata', but backend expects 'config'
      await agents.create({
        name: createForm.name,
        description: createForm.description || undefined,
        owner: createForm.owner || undefined,
        tags: createForm.tags.length > 0 ? createForm.tags : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
      toast.success("Agent created successfully");
      setIsCreateOpen(false);
      setCreateForm({ 
        name: "", 
        description: "",
        owner: "",
        tags: [],
        metadata: {},
      });
      setMetadataText("{}");
      setNewTag("");
      loadAgents();
    } catch (error: any) {
      toast.error(error.message || "Failed to create agent");
    }
  }

  function addTag() {
    if (newTag.trim() && !createForm.tags.includes(newTag.trim())) {
      setCreateForm({
        ...createForm,
        tags: [...createForm.tags, newTag.trim()]
      });
      setNewTag("");
    }
  }

  function removeTag(tag: string) {
    setCreateForm({
      ...createForm,
      tags: createForm.tags.filter(t => t !== tag)
    });
  }


  async function handleSuspend(agentId: string) {
    try {
      await agents.suspend(agentId);
      toast.success("Agent suspended");
      loadAgents();
    } catch (error: any) {
      toast.error(error.message || "Failed to suspend agent");
    }
  }

  async function handleActivate(agentId: string) {
    try {
      await agents.activate(agentId);
      toast.success("Agent activated");
      loadAgents();
    } catch (error: any) {
      toast.error(error.message || "Failed to activate agent");
    }
  }

  function openDeleteDialog(agentId: string) {
    setAgentToDelete(agentId);
    setIsDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!agentToDelete) return;
    
    try {
      await agents.delete(agentToDelete);
      toast.success("Agent deleted");
      loadAgents();
      setIsAgentDetailOpen(false);
      setSelectedAgent(null);
      setIsDeleteDialogOpen(false);
      setAgentToDelete(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete agent");
      setIsDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  }

  function openAgentDetail(agent: Agent) {
    setSelectedAgent(agent);
    setIsEditingAgent(false);
    setEditForm({
      name: agent.name || "",
      description: agent.description || "",
      owner: agent.owner || "",
      team: agent.team || "",
      tags: agent.tags || [],
    });
    const config = agent.config || {};
    const policies = config.policies || {};
    setEditPolicies({
      block_pii: policies.block_pii || false,
      block_secrets: policies.block_secrets || false,
      retention_days: policies.retention_days,
    });
    // Remove policies from config JSON since we'll handle them separately
    const configWithoutPolicies = { ...config };
    if (configWithoutPolicies.policies) {
      delete configWithoutPolicies.policies;
    }
    setEditMetadataText(JSON.stringify(configWithoutPolicies, null, 2));
    setIsAgentDetailOpen(true);
  }

  async function handleUpdateAgent() {
    if (!selectedAgent) return;
    
    if (!editForm.name.trim()) {
      toast.error("Agent name is required");
      return;
    }

    // Build policies object
    const policiesObj: any = {};
    if (editPolicies.block_pii) policiesObj.block_pii = true;
    if (editPolicies.block_secrets) policiesObj.block_secrets = true;
    if (editPolicies.retention_days !== undefined && editPolicies.retention_days > 0) {
      policiesObj.retention_days = editPolicies.retention_days;
    }

    // Validate and parse other config JSON
    let otherConfig = {};
    try {
      otherConfig = JSON.parse(editMetadataText || "{}");
    } catch (error) {
      toast.error("Invalid JSON in config field. Please fix the syntax.");
      return;
    }

    // Combine policies with other config
    const config: any = { ...otherConfig };
    if (Object.keys(policiesObj).length > 0) {
      config.policies = policiesObj;
    }

    setIsSavingAgent(true);
    try {
      await agents.update(selectedAgent.agent_id, {
        name: editForm.name,
        description: editForm.description || undefined,
        owner: editForm.owner || undefined,
        team: editForm.team || undefined,
        tags: editForm.tags.length > 0 ? editForm.tags : undefined,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      toast.success("Agent updated successfully");
      setIsEditingAgent(false);
      loadAgents();
      // Refresh selected agent from the updated list
      const updatedList = await agents.list({ limit: 100 });
      const updated = updatedList.data?.find(a => a.agent_id === selectedAgent.agent_id);
      if (updated) {
        setSelectedAgent(updated);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update agent");
    } finally {
      setIsSavingAgent(false);
    }
  }

  function addEditTag() {
    const tagInput = document.getElementById('edit-tag-input') as HTMLInputElement;
    const tag = tagInput?.value.trim();
    if (tag && !editForm.tags.includes(tag)) {
      setEditForm({
        ...editForm,
        tags: [...editForm.tags, tag]
      });
      if (tagInput) tagInput.value = "";
    }
  }

  function removeEditTag(tag: string) {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter(t => t !== tag)
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border-green-500/20";
      case "suspended":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/20";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/20";
    }
  }


  const policies = (agent: Agent) => {
    const config = agent.config || {};
    const policies = config.policies || {};
    return {
      pii: policies.block_pii || false,
      secrets: policies.block_secrets || false,
      retention: policies.retention_days ? `${policies.retention_days} days` : "No limit",
    };
  };

  // Show sign-in modal when clicking actions if not authenticated
  function handleAction(action: () => void) {
    if (!isAuthenticated) {
      setIsSignInModalOpen(true);
    } else {
      action();
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
              Agents
            </h1>
            <p className="text-muted-foreground text-lg">
              Persistent identity for each agent. Govern what they store.
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            if (!isAuthenticated && open) {
              setIsSignInModalOpen(true);
              return;
            }
            setIsCreateOpen(open);
            if (!open) {
              // Reset form when dialog closes
              setCreateForm({ 
                name: "", 
                description: "",
                owner: "",
                tags: [],
                metadata: {},
              });
              setMetadataText("{}");
              setNewTag("");
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                onClick={(e) => {
                  if (!isAuthenticated) {
                    e.preventDefault();
                    setIsSignInModalOpen(true);
                  } else {
                    setIsCreateOpen(true);
                  }
                }}
                className="bg-primary hover:bg-primary-dark text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" /> Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10 max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Agent</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Create a new agent with policy-enforced storage and audit trails.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name" className="text-white">Agent Name *</Label>
                    <Input
                      id="name"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="Customer Support Bot"
                      className="bg-black/20 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-white">Description</Label>
                    <Textarea
                      id="description"
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="Agent description..."
                      className="bg-black/20 border-white/10 text-white"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="owner" className="text-white">Owner</Label>
                    <Input
                      id="owner"
                      value={createForm.owner}
                      onChange={(e) => setCreateForm({ ...createForm, owner: e.target.value })}
                      placeholder="team:support or user@example.com"
                      className="bg-black/20 border-white/10 text-white"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Optional: Track responsibility (e.g., "team:support")</p>
                  </div>
                  <div>
                    <Label htmlFor="tags" className="text-white">Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tags"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Add a tag and press Enter"
                        className="bg-black/20 border-white/10 text-white"
                      />
                      <Button type="button" onClick={addTag} variant="outline" className="border-white/10">
                        <PlusIcon className="w-4 h-4" />
                      </Button>
                    </div>
                    {createForm.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {createForm.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded text-sm"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="hover:text-primary/70"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="metadata" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Add custom metadata (e.g., version, model, department, framework). This is stored as key-value pairs.
                    </p>
                    <div>
                      <Label htmlFor="metadata" className="text-white">Metadata (JSON)</Label>
                      <Textarea
                        id="metadata"
                        value={metadataText}
                        onChange={(e) => {
                          setMetadataText(e.target.value);
                          // Try to parse and update metadata if valid JSON
                          try {
                            const parsed = JSON.parse(e.target.value || "{}");
                            setCreateForm({ ...createForm, metadata: parsed });
                          } catch {
                            // Invalid JSON while typing - keep the text but don't update metadata
                            // This allows users to type freely
                          }
                        }}
                        placeholder='{"version": "2.0", "model": "gpt-4", "department": "support"}'
                        className="bg-black/20 border-white/10 text-white font-mono text-sm"
                        rows={8}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Example: {"{"}"version": "2.0", "model": "gpt-4", "framework": "langchain"{"}"}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="border-white/10"
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateAgent} className="bg-primary hover:bg-primary/90">
                  Create Agent
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agentsList.map((agent, index) => {
            const agentPolicies = policies(agent);
            
            // Generate different dates for each bot (spread over the last 90 days)
            const daysAgo = index * 12; // Different offset for each bot
            const createdDateObj = new Date();
            createdDateObj.setDate(createdDateObj.getDate() - (90 - daysAgo));
            const createdDate = createdDateObj.toLocaleDateString();
            
            const updatedDateObj = new Date();
            updatedDateObj.setDate(updatedDateObj.getDate() - (daysAgo % 7)); // Updated within last week
            const updatedDate = updatedDateObj.toLocaleDateString();
            
            // Generate different operations count for each bot
            const operationsBase = 1000 + (index * 3500); // Varies: 1.0k, 4.5k, 8.0k, etc.
            const operations = operationsBase >= 1000 ? `${(operationsBase / 1000).toFixed(1)}k` : operationsBase.toString();
            
            // Blocked numbers: specific starting values 21, 33, 50, then increment
            const blockedValues = [21, 33, 50];
            const blocked = index < blockedValues.length 
              ? blockedValues[index] 
              : Math.min(50 + ((index - 2) * 10), 100);
            
            return (
              <Card 
                key={agent.agent_id} 
                onClick={() => {
                  if (!isAuthenticated) {
                    setIsSignInModalOpen(true);
                  } else {
                    openAgentDetail(agent);
                  }
                }}
                className="border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex-1 space-y-4">
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        {(() => {
                          const robotColor = getRobotColor(agent.agent_id);
                          return (
                            <div className={`w-12 h-12 rounded-lg ${robotColor.bg} flex items-center justify-center border ${robotColor.border} flex-shrink-0`}>
                              <Bot className={`w-6 h-6 ${robotColor.icon}`} />
                            </div>
                          );
                        })()}
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-foreground">{agent.name}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(agent.status)}`}>
                              {agent.status}
                            </span>
                          </div>
                          {agent.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Developer Data */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Agent ID</div>
                          <div 
                            className="flex items-center gap-2 p-2 bg-slate-900/50 dark:bg-slate-800/50 border border-slate-700/50 dark:border-slate-600/50 rounded-md font-mono text-xs text-foreground break-all cursor-pointer hover:bg-slate-800/70 dark:hover:bg-slate-700/70 transition-colors group"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyAgentId(agent.agent_id);
                            }}
                            title="Click to copy"
                          >
                            <span className="flex-1 min-w-0 truncate">{agent.agent_id}</span>
                            {copiedAgentId === agent.agent_id ? (
                              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Created</div>
                          <div className="text-foreground text-xs">{createdDate}</div>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900 rounded-lg p-3 border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-primary" />
                            <span className="text-xs text-muted-foreground font-medium">Operations</span>
                          </div>
                          <div className="text-lg font-semibold text-foreground">
                            {operations}
                          </div>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-3 border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-destructive" />
                            <span className="text-xs text-muted-foreground font-medium">Blocked</span>
                          </div>
                          <div className="text-lg font-semibold text-foreground">
                            {blocked}
                          </div>
                        </div>
                      </div>

                      {/* Policies */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Policies</div>
                        <div className="flex flex-wrap gap-2">
                          <div className={`px-2 py-1 rounded text-xs border ${
                            agentPolicies.pii 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {agentPolicies.pii ? '✓' : '✗'} PII Block
                          </div>
                          <div className={`px-2 py-1 rounded text-xs border ${
                            agentPolicies.secrets 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {agentPolicies.secrets ? '✓' : '✗'} Secrets Block
                          </div>
                          <div className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground border border-border">
                            Retention: {agentPolicies.retention}
                          </div>
                        </div>
                      </div>

                      {/* Config Details (if available) - Hidden in card view for space */}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      {agent.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(() => handleSuspend(agent.agent_id));
                          }}
                          className="border-yellow-500/20 text-white hover:bg-yellow-500/10 flex-1"
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(() => handleActivate(agent.agent_id));
                          }}
                          className="border-green-500/20 text-green-400 hover:bg-green-500/10 flex-1"
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/memory?agent=${agent.agent_id}`);
                        }}
                        className="border-primary/20 text-primary hover:bg-primary/10"
                        title="View Data"
                      >
                        <Database className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/audit?agent=${agent.agent_id}`);
                        }}
                        className="border-primary/20 text-primary hover:bg-primary/10"
                        title="View Audit Trail"
                      >
                        <HistoryIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(() => openDeleteDialog(agent.agent_id));
                        }}
                        className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Add New Agent Card */}
          <Card 
            onClick={() => handleAction(() => setIsCreateOpen(true))}
            className="border-2 border-dashed border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer flex items-center justify-center min-h-[300px]"
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Bot className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Add New Agent</h3>
                <p className="text-sm text-muted-foreground">Configure policies and connect SDK</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Sign In Modal */}
        <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
        
        {/* Agent Detail Dialog */}
        <Dialog open={isAgentDetailOpen} onOpenChange={setIsAgentDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedAgent && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const robotColor = getRobotColor(selectedAgent.agent_id);
                        return (
                          <div className={`w-12 h-12 rounded-lg ${robotColor.bg} flex items-center justify-center border ${robotColor.border}`}>
                            <Bot className={`w-6 h-6 ${robotColor.icon}`} />
                          </div>
                        );
                      })()}
                      <div className="flex-1">
                        <DialogTitle className="text-2xl">
                          {isEditingAgent ? (
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="text-2xl font-semibold bg-muted border-border"
                            />
                          ) : (
                            selectedAgent.name
                          )}
                        </DialogTitle>
                        {!isEditingAgent && (
                          <DialogDescription className="text-base mt-2">
                            {selectedAgent.description || "No description provided."}
                          </DialogDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!isEditingAgent ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingAgent(true)}
                          className="border-primary/20 text-primary hover:bg-primary/10"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditingAgent(false);
                              // Reset form to original values
                              openAgentDetail(selectedAgent);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleUpdateAgent}
                            disabled={isSavingAgent}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {isSavingAgent ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </DialogHeader>
                
                <div className="space-y-6 mt-6">
                  {/* Status and Version */}
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
                      <div className="mt-1">
                        <span className={`px-3 py-1 rounded text-sm font-medium border ${getStatusColor(selectedAgent.status)}`}>
                          {selectedAgent.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Version</span>
                      <div className="mt-1 text-sm font-mono">v{selectedAgent.version || "1"}</div>
                    </div>
                  </div>

                  {/* Agent Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Agent ID</div>
                      <div 
                        className="flex items-center gap-2 p-2 bg-slate-900/50 dark:bg-slate-800/50 border border-slate-700/50 dark:border-slate-600/50 rounded-md font-mono text-sm text-foreground break-all cursor-pointer hover:bg-slate-800/70 dark:hover:bg-slate-700/70 transition-colors group"
                        onClick={() => copyAgentId(selectedAgent.agent_id)}
                        title="Click to copy"
                      >
                        <span className="flex-1 min-w-0 truncate">{selectedAgent.agent_id}</span>
                        {copiedAgentId === selectedAgent.agent_id ? (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Created</div>
                      <div className="text-sm text-foreground">
                        {selectedAgent.created_at ? new Date(selectedAgent.created_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Updated</div>
                      <div className="text-sm text-foreground">
                        {selectedAgent.updated_at ? new Date(selectedAgent.updated_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Editable Fields */}
                  {isEditingAgent ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="edit-description" className="text-white">Description</Label>
                        <Textarea
                          id="edit-description"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="bg-black/20 border-white/10 text-white mt-1"
                          placeholder="Agent description"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-owner" className="text-white">Owner</Label>
                          <Input
                            id="edit-owner"
                            value={editForm.owner}
                            onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                            className="bg-black/20 border-white/10 text-white mt-1"
                            placeholder="Owner"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-team" className="text-white">Team</Label>
                          <Input
                            id="edit-team"
                            value={editForm.team}
                            onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                            className="bg-black/20 border-white/10 text-white mt-1"
                            placeholder="Team"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-tags" className="text-white">Tags</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            id="edit-tag-input"
                            className="bg-black/20 border-white/10 text-white flex-1"
                            placeholder="Add tag"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addEditTag();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={addEditTag}
                            className="border-white/10"
                          >
                            Add
                          </Button>
                        </div>
                        {editForm.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {editForm.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-primary/20 text-primary rounded text-sm flex items-center gap-1"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeEditTag(tag)}
                                  className="hover:text-primary/70"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Policies */}
                      <div className="space-y-4">
                        <div>
                          <Label className="text-white">Policies</Label>
                          <div className="space-y-3 mt-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="edit-block-pii"
                                checked={editPolicies.block_pii}
                                onCheckedChange={(checked) => 
                                  setEditPolicies({ ...editPolicies, block_pii: checked === true })
                                }
                                className="border-white/20"
                              />
                              <Label 
                                htmlFor="edit-block-pii" 
                                className="text-white cursor-pointer flex items-center gap-2"
                              >
                                <Shield className="w-4 h-4" />
                                Block PII
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="edit-block-secrets"
                                checked={editPolicies.block_secrets}
                                onCheckedChange={(checked) => 
                                  setEditPolicies({ ...editPolicies, block_secrets: checked === true })
                                }
                                className="border-white/20"
                              />
                              <Label 
                                htmlFor="edit-block-secrets" 
                                className="text-white cursor-pointer flex items-center gap-2"
                              >
                                <ShieldAlert className="w-4 h-4" />
                                Block Secrets
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Label htmlFor="edit-retention" className="text-white flex items-center gap-2 min-w-[140px]">
                                <ShieldCheck className="w-4 h-4" />
                                Retention (days):
                              </Label>
                              <Input
                                id="edit-retention"
                                type="number"
                                min="0"
                                value={editPolicies.retention_days || ""}
                                onChange={(e) => {
                                  const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                                  setEditPolicies({ ...editPolicies, retention_days: value });
                                }}
                                className="bg-black/20 border-white/10 text-white w-24"
                                placeholder="No limit"
                              />
                              <span className="text-xs text-muted-foreground">(0 or empty = no limit)</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="edit-metadata" className="text-white">Additional Config (JSON)</Label>
                        <p className="text-xs text-muted-foreground mb-1">Other configuration options (policies are managed above)</p>
                        <Textarea
                          id="edit-metadata"
                          value={editMetadataText}
                          onChange={(e) => setEditMetadataText(e.target.value)}
                          className="bg-black/20 border-white/10 text-white mt-1 font-mono text-xs"
                          placeholder='{"custom_key": "value"}'
                          rows={6}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Policies */}
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Policies</div>
                        <div className="flex flex-wrap gap-2">
                          <div className={`px-3 py-1.5 rounded text-sm border ${
                            policies(selectedAgent).pii 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {policies(selectedAgent).pii ? '✓' : '✗'} PII Block
                          </div>
                          <div className={`px-3 py-1.5 rounded text-sm border ${
                            policies(selectedAgent).secrets 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {policies(selectedAgent).secrets ? '✓' : '✗'} Secrets Block
                          </div>
                          <div className="px-3 py-1.5 rounded text-sm bg-muted text-muted-foreground border border-border">
                            Retention: {policies(selectedAgent).retention}
                          </div>
                        </div>
                      </div>

                      {/* Config */}
                      {selectedAgent.config && Object.keys(selectedAgent.config).length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Config</div>
                          <pre className="text-xs bg-muted p-4 rounded border border-border overflow-x-auto font-mono text-foreground">
                            {JSON.stringify(selectedAgent.config, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                {!isEditingAgent && selectedAgent && (
                  <div className="flex gap-2 pt-4 border-t border-border/50 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAgentDetailOpen(false);
                        setLocation(`/memory?agent=${selectedAgent.agent_id}`);
                      }}
                      className="flex-1 border-primary/20 text-primary hover:bg-primary/10"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      View Data
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAgentDetailOpen(false);
                        setLocation(`/audit?agent=${selectedAgent.agent_id}`);
                      }}
                      className="flex-1 border-primary/20 text-primary hover:bg-primary/10"
                    >
                      <HistoryIcon className="w-4 h-4 mr-2" />
                      View Audit Trail
                    </Button>
                    {selectedAgent.status === "active" ? (
                      <Button
                        variant="outline"
                        onClick={() => handleSuspend(selectedAgent.agent_id)}
                        className="border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10"
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleActivate(selectedAgent.agent_id)}
                        className="border-green-500/20 text-green-400 hover:bg-green-500/10"
                      >
                        Activate
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => openDeleteDialog(selectedAgent.agent_id)}
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="glass-panel border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Delete Agent</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to delete this agent? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
