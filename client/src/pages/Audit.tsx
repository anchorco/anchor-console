import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Search, Download, Shield, Lock, ArrowRight, AlertCircle, Filter, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { agents, audit, Agent } from "@/lib/api";
import SignInModal from "@/components/SignInModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Audit() {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
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
      setIsLoading(true); // Start loading immediately
      loadAgents().then((agentsList) => {
        // Wait for agents to load before loading data
        if (agentsList.length > 0) {
          loadData(true);
        } else {
          // No agents found - clear loading state
          setIsLoading(false);
          setAuditEvents([]);
        }
      }).catch((error) => {
        console.error('Failed to load agents:', error);
        setIsLoading(false);
        setAuditEvents([]);
      });
    } else {
      // Show mock data when not authenticated
      setAuditEvents([
        {
          id: "evt_1",
          timestamp: "2025-12-31 12:59:10",
          operation: "data.write",
          resource: "user:123:preference",
          result: "allowed",
          agent: "Customer Support Bot",
          hash: "3a505f55-26f6-4a",
          details: "Stored value 'dark_mode'"
        },
        {
          id: "evt_2",
          timestamp: "2025-12-31 12:59:10",
          operation: "data.write",
          resource: "user:123:email",
          result: "blocked",
          agent: "Customer Support Bot",
          hash: "5cec639f-edb1-4c",
          details: "Blocked by policy:block_pii"
        },
        {
          id: "evt_3",
          timestamp: "2025-12-31 12:59:10",
          operation: "data.write",
          resource: "config:api_key",
          result: "blocked",
          agent: "Customer Support Bot",
          hash: "84748ca5-cfdd-4e",
          details: "Blocked by policy:block_secrets"
        },
        {
          id: "evt_4",
          timestamp: "2025-12-31 12:59:10",
          operation: "checkpoint.create",
          resource: "bd37f321",
          result: "success",
          agent: "System",
          hash: "348ce048-a2aa-41",
          details: "Label: before-bulk-update"
        },
        {
          id: "evt_5",
          timestamp: "2025-12-31 12:59:10",
          operation: "checkpoint.restore",
          resource: "bd37f321",
          result: "success",
          agent: "System",
          hash: "a251b27a-d3f3-41",
          details: "Restored 3 keys"
        }
      ]);
    }
  }, [isAuthenticated]);

  async function loadAgents(): Promise<Agent[]> {
    try {
      const agentsResponse = await agents.list({ limit: 100 });
      const agentsList = agentsResponse.data || [];
      setAllAgents(agentsList);
      return agentsList;
    } catch (error) {
      console.error('Failed to load agents:', error);
      setAllAgents([]);
      return [];
    }
  }

  async function loadData(reset: boolean = true) {
    if (!isAuthenticated) {
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }
    
    // If no agents loaded yet, try loading them first
    if (allAgents.length === 0) {
      const agentsList = await loadAgents();
      if (agentsList.length === 0) {
        setIsLoading(false);
        setIsLoadingMore(false);
        setAuditEvents([]);
        return;
      }
    }
    
    if (reset) {
      setIsLoading(true);
      setAuditEvents([]);
      setLoadedAgentCount(0);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      // Determine which agents to check
      const agentsToCheck = selectedAgentId
        ? allAgents.filter(a => a.agent_id === selectedAgentId)
        : allAgents; // All agents if no filter
      
      if (agentsToCheck.length === 0) {
        // No agents to check - finish loading
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMore(false);
        return;
      }
      
      // Load events in batches - process multiple agents in parallel and display as we go
      const batchSize = 3; // Process 3 agents at a time for faster loading
      const eventsPerAgent = 500; // Load 500 events per agent per batch
      
      const startIndex = reset ? 0 : loadedAgentCount;
      const agentsToProcess = agentsToCheck.slice(startIndex, startIndex + batchSize);
      
      if (agentsToProcess.length === 0) {
        // No more agents to process
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }
      
      // Process agents in parallel - each agent loads independently
      const agentPromises = agentsToProcess.map(async (agent) => {
        try {
          // Get first batch of events for this agent
          const auditResponse = await audit.query(agent.agent_id, {
            limit: eventsPerAgent,
            offset: 0,
          });
          
          const events = auditResponse.events || [];
          
          // Map to UI format
          const mappedEvents = events.map((e: any) => ({
            id: e.id || e.entry_id,
            timestamp: new Date(e.timestamp || e.created_at).toLocaleString(),
            operation: e.operation || e.event_type || e.action || 'unknown',
            resource: e.resource || 'N/A',
            result: e.result || 'unknown',
            agent: agent.name || agent.agent_id,
            agentId: agent.agent_id,
            hash: e.hash || e.entry_hash || 'N/A',
            details: e.data ? JSON.stringify(e.data) : (e.blocked_by ? `Blocked by: ${e.blocked_by}` : ''),
          }));
          
          return mappedEvents;
        } catch (error) {
          // If audit query fails for an agent, continue with others
          console.warn(`Failed to load audit for agent ${agent.agent_id}:`, error);
          return [];
        }
      });
      
      // Process agents one by one and display events as they arrive
      for (let i = 0; i < agentPromises.length; i++) {
        const events = await agentPromises[i];
        
        // Add events immediately as they arrive from each agent
        setAuditEvents((prev) => {
          const combined = [...prev, ...events];
          // Sort by timestamp (most recent first)
          combined.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
          });
          return combined;
        });
        
        // Small delay to allow UI to update between agents
        if (i < agentPromises.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
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
      console.error('Failed to load audit data:', error);
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  // Reload data when agent filter changes
  useEffect(() => {
    if (isAuthenticated && allAgents.length > 0) {
      loadData(true); // Reset when filter changes
    } else if (isAuthenticated && allAgents.length === 0 && !isLoading) {
      // No agents yet, but we're authenticated - clear loading state
      setIsLoading(false);
    }
  }, [selectedAgentId]);

  function handleAgentFilterChange(agentId: string) {
    setSelectedAgentId(agentId);
    // Update URL
    const params = new URLSearchParams(window.location.search);
    if (agentId && agentId !== 'all') {
      params.set('agent', agentId);
    } else {
      params.delete('agent');
    }
    const newUrl = params.toString() ? `/audit?${params.toString()}` : '/audit';
    setLocation(newUrl);
  }

  function clearAgentFilter() {
    setSelectedAgentId(null);
    setLocation('/audit');
  }
  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
              Audit Trail
            </h1>
            <p className="text-muted-foreground text-lg">
              Hash-chained, tamper-evident log of every operation. Prove what happened.
            </p>
            {selectedAgentId && (
              <p className="text-sm text-muted-foreground mt-1">
                Showing audit trail for: <span className="text-foreground font-medium">
                  {allAgents.find(a => a.agent_id === selectedAgentId)?.name || selectedAgentId}
                </span>
                {!isLoading && (
                  <span className="ml-2">
                    ({auditEvents.length} event{auditEvents.length !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
            )}
            {!selectedAgentId && !isLoading && auditEvents.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Showing {auditEvents.length} event{auditEvents.length !== 1 ? 's' : ''} across all agents
              </p>
            )}
          </div>
          <div className="flex gap-3">
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
            <button 
              onClick={() => !isAuthenticated && setIsSignInModalOpen(true)}
              className="bg-card border border-border hover:border-primary/50 px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <Shield className="w-4 h-4 text-success" /> Verify Chain Integrity
            </button>
            <button 
              onClick={() => !isAuthenticated && setIsSignInModalOpen(true)}
              className="bg-primary hover:bg-primary-dark text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export for Compliance
            </button>
          </div>
        </div>

        {/* Loading State - Only show if no events loaded yet */}
        {isLoading && auditEvents.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading audit events...</p>
            {selectedAgentId && (
              <p className="text-sm text-muted-foreground mt-2">
                Fetching events for {allAgents.find(a => a.agent_id === selectedAgentId)?.name || selectedAgentId}...
              </p>
            )}
          </div>
        )}

        {/* Timeline View */}
        {!isLoading && auditEvents.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {selectedAgentId 
                ? `No audit events found for this agent. Operations will appear here once the agent is used.`
                : "No audit events yet. Operations will appear here once you start using agents."}
            </p>
          </div>
        ) : !isLoading && (
          <div className="relative pl-8 border-l border-border space-y-8">
            {auditEvents.map((event, i) => {
              // Show sign-in modal when clicking if not authenticated
              const handleEventClick = () => {
                if (!isAuthenticated) {
                  setIsSignInModalOpen(true);
                }
              };
              
              return (
            <div key={event.id} className="relative group">
              {/* Timeline Dot */}
              <div className={`absolute -left-[39px] top-6 w-5 h-5 rounded-full border-4 border-background ${
                event.result === 'blocked' ? 'bg-red-500 shadow-[0_0_10px_var(--destructive)]' : 
                event.result === 'success' ? 'bg-green-500 shadow-[0_0_10px_#10b981]' : 
                'bg-green-500 shadow-[0_0_10px_#10b981]'
              } transition-all duration-300 group-hover:scale-125`} />

              <div 
                onClick={handleEventClick}
                className="bg-card border border-border p-5 rounded-lg transition-all duration-200 hover:border-primary/50 cursor-pointer"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      event.result === 'blocked' ? 'bg-red-500/10 text-red-400' : 
                      event.result === 'success' ? 'bg-green-500/10 text-green-400' : 
                      'bg-green-500/10 text-green-400'
                    }`}>
                      {event.result === 'blocked' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{event.operation}</h3>
                      <p className="text-sm text-muted-foreground">{event.agent}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono text-muted-foreground">{event.timestamp}</span>
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border font-mono text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      {event.hash}
                    </div>
                  </div>
                </div>

                <div className="bg-muted rounded-lg p-3 border border-border flex items-center justify-between hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2 text-sm text-foreground font-mono">
                    <span className="text-muted-foreground">Resource:</span>
                    {event.resource}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm text-foreground">
                    {event.details}
                  </div>
                </div>
              </div>
            </div>
              );
            })}
            
            {/* Loading More Indicator */}
            {isLoadingMore && auditEvents.length > 0 && (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Loading more events... ({auditEvents.length} loaded so far)
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
                  Load More Events
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
