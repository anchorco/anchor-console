import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, Database, FileText, Clock, Tag, Trash2, Eye, AlertCircle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { agents, data, Agent } from "@/lib/api";
import SignInModal from "@/components/SignInModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Memory() {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadedAgentCount, setLoadedAgentCount] = useState(0);
  
  // Get agent filter from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agentParam = params.get('agent');
    if (agentParam) {
      setSelectedAgentId(agentParam);
    }
  }, [location]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
      loadData(true);
    } else {
      // Show mock data when not authenticated
      setMemoryItems([
        { key: "user:123:preference", value: "dark_mode", type: "String", created: "2025-12-31 12:59:10", tags: ["preference", "ui"] },
        { key: "user:123:language", value: "English", type: "String", created: "2025-12-31 12:59:10", tags: ["preference", "locale"] },
        { key: "user:123:timezone", value: "UTC-5", type: "String", created: "2025-12-31 12:59:10", tags: ["preference", "locale"] },
        { key: "session:456:context", value: "{ last_topic: 'billing' }", type: "JSON", created: "2025-12-31 12:58:45", tags: ["context", "session"] },
        { key: "user:123:summary", value: "User asked about pricing...", type: "Text", created: "2025-12-31 12:55:20", tags: ["summary", "long-term"] },
      ]);
    }
  }, [isAuthenticated]);

  async function loadAgents() {
    try {
      const agentsResponse = await agents.list({ limit: 100 });
      setAllAgents(agentsResponse.data || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  }

  async function loadData(reset: boolean = true) {
    if (!isAuthenticated) return;
    
    if (reset) {
      setIsLoading(true);
      setMemoryItems([]);
      setLoadedAgentCount(0);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      // Determine which agents to check
      const agentsToCheck = selectedAgentId
        ? allAgents.filter(a => a.agent_id === selectedAgentId)
        : allAgents; // All agents if no filter
      
      if (agentsToCheck.length === 0 && selectedAgentId) {
        // Agent filter set but agent not found - might still be loading
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }
      
      // Load data in batches - process multiple agents in parallel and display as we go
      const batchSize = 3; // Process 3 agents at a time for faster loading
      const entriesPerAgent = 500; // Load 500 entries per agent per batch
      
      const startIndex = reset ? 0 : loadedAgentCount;
      const agentsToProcess = agentsToCheck.slice(startIndex, startIndex + batchSize);
      
      if (agentsToProcess.length === 0) {
        // No more agents to process
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }
      
      // Process agents one by one and display entries as they arrive
      for (const agent of agentsToProcess) {
        try {
          // Get data entries for this agent
          const dataResponse = await data.list(agent.agent_id, {
            limit: entriesPerAgent,
            full: true, // Get full entries with metadata
          });
          
          const entries = dataResponse.data || [];
          
          // Map to UI format
          const mappedEntries = entries.map((entry: any) => ({
            key: entry.key,
            value: typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value),
            type: typeof entry.value === 'string' ? 'String' : 
                  typeof entry.value === 'object' ? 'JSON' : 'Text',
            created: new Date(entry.created_at || entry.created).toLocaleString(),
            tags: entry.metadata?.tags || [],
            agent: agent.name || agent.agent_id,
            agentId: agent.agent_id,
          }));
          
          // Add entries immediately as they arrive from each agent
          setMemoryItems((prev) => {
            const combined = [...prev, ...mappedEntries];
            // Sort by created date (most recent first)
            combined.sort((a, b) => {
              const timeA = new Date(a.created).getTime();
              const timeB = new Date(b.created).getTime();
              return timeB - timeA;
            });
            return combined;
          });
          
          // Small delay to allow UI to update between agents
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          // If data query fails for an agent, continue with others
          console.warn(`Failed to load data for agent ${agent.agent_id}:`, error);
        }
      }
      
      // Update progress
      const newLoadedCount = startIndex + agentsToProcess.length;
      setLoadedAgentCount(newLoadedCount);
      setHasMore(newLoadedCount < agentsToCheck.length);
      
      // If there are more agents, load next batch automatically
      if (newLoadedCount < agentsToCheck.length) {
        // Small delay to allow UI to update
        setTimeout(() => {
          loadData(false);
        }, 200);
      } else {
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load memory data:', error);
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  // Reload data when agent filter changes
  useEffect(() => {
    if (isAuthenticated && allAgents.length > 0) {
      loadData(true); // Reset when filter changes
    }
  }, [selectedAgentId, isAuthenticated, allAgents.length]);

  function handleAgentFilterChange(agentId: string) {
    setSelectedAgentId(agentId);
    // Update URL
    const params = new URLSearchParams(window.location.search);
    if (agentId && agentId !== 'all') {
      params.set('agent', agentId);
    } else {
      params.delete('agent');
    }
    const newUrl = params.toString() ? `/memory?${params.toString()}` : '/memory';
    setLocation(newUrl);
  }

  function clearAgentFilter() {
    setSelectedAgentId(null);
    setLocation('/memory');
  }

  // Show sign-in modal when clicking actions if not authenticated
  function handleAction() {
    if (!isAuthenticated) {
      setIsSignInModalOpen(true);
    }
  }
  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            {selectedAgentId && (
              <p className="text-sm text-muted-foreground mt-1">
                Showing data for: <span className="text-foreground font-medium">
                  {allAgents.find(a => a.agent_id === selectedAgentId)?.name || selectedAgentId}
                </span>
                {!isLoading && (
                  <span className="ml-2">
                    ({memoryItems.length} entr{memoryItems.length !== 1 ? 'ies' : 'y'})
                  </span>
                )}
              </p>
            )}
            {!selectedAgentId && !isLoading && memoryItems.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Showing {memoryItems.length} entr{memoryItems.length !== 1 ? 'ies' : 'y'} across all agents
              </p>
            )}
          </div>
          {/* Agent Filter */}
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {allAgents.length > 0 ? (
                <>
                  <Select
                    value={selectedAgentId || 'all'}
                    onValueChange={(value) => handleAgentFilterChange(value === 'all' ? '' : value)}
                  >
                    <SelectTrigger className="w-[200px] bg-card border-border">
                      <SelectValue placeholder="Filter by agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {allAgents.map((agent) => (
                        <SelectItem key={agent.agent_id} value={agent.agent_id}>
                          {agent.name || agent.agent_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAgentId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAgentFilter}
                      className="h-9 px-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </>
              ) : (
                <Select disabled>
                  <SelectTrigger className="w-[200px] bg-card border-border opacity-50">
                    <SelectValue placeholder="Loading agents..." />
                  </SelectTrigger>
                </Select>
              )}
            </div>
          )}
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-card border border-border p-4 rounded-lg flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search keys or values..." 
              onClick={() => handleAction()}
              className="w-full bg-background border border-input rounded-lg pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all cursor-pointer"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => handleAction()}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-background border border-border hover:border-primary/50 text-foreground transition-colors"
            >
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button 
              onClick={() => handleAction()}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-background border border-border hover:border-primary/50 text-foreground transition-colors"
            >
              <Database className="w-4 h-4" /> All Agents
            </button>
          </div>
        </div>

        {/* Loading State - Only show if no items loaded yet */}
        {isLoading && memoryItems.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading data entries...</p>
            {selectedAgentId && (
              <p className="text-sm text-muted-foreground mt-2">
                Fetching data for {allAgents.find(a => a.agent_id === selectedAgentId)?.name || selectedAgentId}...
              </p>
            )}
          </div>
        )}

        {/* Memory Grid */}
        {!isLoading && memoryItems.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {selectedAgentId 
                ? `No data entries found for this agent. Data will appear here once the agent writes data.`
                : "No data stored yet. Start by creating an agent and writing data."}
            </p>
          </div>
        ) : !isLoading && (
          <div className="grid grid-cols-1 gap-4">
            {memoryItems.map((item, i) => (
              <div 
                key={i} 
                onClick={() => handleAction()}
                className="bg-card border border-border p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4 group hover:border-primary/50 transition-all cursor-pointer"
              >
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <FileText className="w-6 h-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-mono font-medium text-foreground truncate">{item.key}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-muted-foreground font-mono text-sm truncate">
                    {item.value}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end min-w-[200px]">
                  {item.tags?.map((tag: string) => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground border border-border">
                      <Tag className="w-3 h-3" /> {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground border-l border-border pl-4 ml-2">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{item.created?.split(' ')[1]}</span>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={handleAction}
                      className="p-1.5 rounded-md hover:bg-accent hover:text-foreground transition-colors" 
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleAction}
                      className="p-1.5 rounded-md hover:bg-destructive/20 hover:text-destructive transition-colors" 
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading More Indicator */}
            {isLoadingMore && memoryItems.length > 0 && (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Loading more entries... ({memoryItems.length} loaded so far)
                </p>
              </div>
            )}
            
            {/* Load More Button (if there are more agents to process) */}
            {!isLoading && !isLoadingMore && hasMore && (
              <div className="text-center py-8">
                <Button
                  variant="outline"
                  onClick={() => loadData(false)}
                  className="border-primary/20 text-primary hover:bg-primary/10"
                >
                  Load More Entries
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* Sign In Modal */}
        <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
      </div>
    </Layout>
  );
}
