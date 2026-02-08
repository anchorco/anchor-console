import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ShieldAlert, CheckCircle, Database, ArrowUpRight, Lock, History as HistoryIcon, TrendingUp, TrendingDown, HardDrive, AlertTriangle, Clock } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { agents, audit } from "@/lib/api";
import SignInModal from "@/components/SignInModal";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [chartTimePeriod, setChartTimePeriod] = useState<'day' | 'month' | 'year'>('day');
  const [stats, setStats] = useState({
    operations: "0",
    blocked: "0",
    agents: "0",
    totalAgents: "0",
    verified: "100%",
    dataStorage: "0",
    dataStorageGrowth: "0%"
  });
  const [data, setData] = useState([
    { time: "00:00", allowed: 0, blocked: 0 },
    { time: "04:00", allowed: 0, blocked: 0 },
    { time: "08:00", allowed: 0, blocked: 0 },
    { time: "12:00", allowed: 0, blocked: 0 },
    { time: "16:00", allowed: 0, blocked: 0 },
    { time: "20:00", allowed: 0, blocked: 0 },
    { time: "24:00", allowed: 0, blocked: 0 },
  ]);
  const [chartSummary, setChartSummary] = useState({ total: 0, allowed: 0, blocked: 0, blockedPercent: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      // Reset stats immediately when signing in to clear any mock data
      setStats({
        operations: "0",
        blocked: "0",
        agents: "0",
        totalAgents: "0",
        verified: "100%",
        dataStorage: "0",
        dataStorageGrowth: "0%"
      });
      setRecentActivity([]);
      setData([
        { time: "00:00", allowed: 0, blocked: 0 },
        { time: "04:00", allowed: 0, blocked: 0 },
        { time: "08:00", allowed: 0, blocked: 0 },
        { time: "12:00", allowed: 0, blocked: 0 },
        { time: "16:00", allowed: 0, blocked: 0 },
        { time: "20:00", allowed: 0, blocked: 0 },
        { time: "24:00", allowed: 0, blocked: 0 },
      ]);
      setChartSummary({ total: 0, allowed: 0, blocked: 0, blockedPercent: 0 });
      // Then load real data
      loadData();
    } else {
      // Show mock data when not authenticated
      // Start with random active agents count between 7-10, total is 12
      const initialAgents = Math.floor(Math.random() * 4) + 7; // Random between 7-10
      setStats({ 
        operations: "12,450", 
        blocked: "342", 
        agents: String(initialAgents),
        totalAgents: "12",
        verified: "100%",
        dataStorage: "2.4 GB",
        dataStorageGrowth: "+8.2%"
      });
      // Chart data will be set by updateChartData function via useEffect
      setRecentActivity([
        { id: 1, action: "Data Write", agent: "Support Bot", status: "Allowed", time: "2 min ago", hash: "8f3a...9b2c" },
        { id: 2, action: "PII Blocked", agent: "Sales Agent", status: "Blocked", time: "5 min ago", hash: "2c1d...4e5f" },
        { id: 3, action: "Checkpoint", agent: "System", status: "Success", time: "12 min ago", hash: "7a8b...1c2d" },
        { id: 4, action: "Secret Blocked", agent: "Dev Bot", status: "Blocked", time: "15 min ago", hash: "9e8f...3a4b" },
      ]);
    }
  }, [isAuthenticated]);

  // Simulate active operations when not authenticated
  useEffect(() => {
    if (isAuthenticated) return;

    const operations = [
      { action: "Data Write", agent: "Support Bot", status: "Allowed" as const },
      { action: "Data Write", agent: "Sales Agent", status: "Allowed" as const },
      { action: "Data Read", agent: "Support Bot", status: "Allowed" as const },
      { action: "PII Blocked", agent: "Sales Agent", status: "Blocked" as const },
      { action: "Data Write", agent: "Dev Bot", status: "Allowed" as const },
      { action: "Secret Blocked", agent: "Dev Bot", status: "Blocked" as const },
      { action: "Config Update", agent: "System", status: "Success" as const },
      { action: "Checkpoint Created", agent: "System", status: "Success" as const },
      { action: "Data Delete", agent: "Support Bot", status: "Allowed" as const },
      { action: "Custom Pattern Blocked", agent: "Sales Agent", status: "Blocked" as const },
    ];

    const agents = ["Support Bot", "Sales Agent", "Dev Bot", "System", "Analytics Bot"];
    
    const generateHash = () => {
      const chars = "0123456789abcdef";
      return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("") + 
             "..." + 
             Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    };

    const getTimeAgo = (seconds: number) => {
      if (seconds < 60) return `${seconds} sec ago`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
      return `${Math.floor(seconds / 3600)} hr ago`;
    };

    let counter = 5; // Start from 5 to avoid conflicts with initial mock data
    let timeCounter = 0;

    const interval = setInterval(() => {
      // Add a new operation every 3-8 seconds
      const randomOp = operations[Math.floor(Math.random() * operations.length)];
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      
      timeCounter += Math.floor(Math.random() * 5) + 3; // Increment time by 3-7 seconds
      
      const newActivity = {
        id: counter++,
        action: randomOp.action,
        agent: randomAgent,
        status: randomOp.status,
        time: getTimeAgo(timeCounter),
        hash: generateHash(),
      };

      setRecentActivity((prev) => {
        // Add to top, keep max 10 items
        const updated = [newActivity, ...prev];
        return updated.slice(0, 10);
      });

      // Update stats occasionally
      if (Math.random() > 0.7) {
        setStats((prev) => {
          const ops = parseInt(prev.operations.replace(/,/g, "")) + 1;
          return {
            ...prev,
            operations: ops.toLocaleString(),
          };
        });
      }

      if (randomOp.status === "Blocked" && Math.random() > 0.5) {
        setStats((prev) => {
          const blocked = parseInt(prev.blocked.replace(/,/g, "")) + 1;
          return {
            ...prev,
            blocked: blocked.toLocaleString(),
          };
        });
      }

      // Occasionally update active agents count (7-10)
      if (Math.random() > 0.6) {
        setStats((prev) => {
          const newAgentsCount = Math.floor(Math.random() * 4) + 7; // Random between 7-10
          return {
            ...prev,
            agents: String(newAgentsCount),
            // Keep totalAgents at 12 for mock data
            totalAgents: prev.totalAgents || "12",
          };
        });
      }
    }, Math.random() * 5000 + 3000); // Random interval between 3-8 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Function to update chart data based on time period
  function updateChartData(period: 'day' | 'month' | 'year') {
    if (isAuthenticated) {
      // For authenticated users, set empty data
      setData([
        { time: "00:00", allowed: 0, blocked: 0 },
        { time: "04:00", allowed: 0, blocked: 0 },
        { time: "08:00", allowed: 0, blocked: 0 },
        { time: "12:00", allowed: 0, blocked: 0 },
        { time: "16:00", allowed: 0, blocked: 0 },
        { time: "20:00", allowed: 0, blocked: 0 },
        { time: "24:00", allowed: 0, blocked: 0 },
      ]);
      return;
    }

    if (period === 'day') {
      // Hourly data for a day
      const dayData = [
        { time: "00:00", allowed: 45, blocked: 2 },
        { time: "04:00", allowed: 30, blocked: 1 },
        { time: "08:00", allowed: 85, blocked: 5 },
        { time: "12:00", allowed: 120, blocked: 12 },
        { time: "16:00", allowed: 95, blocked: 8 },
        { time: "20:00", allowed: 60, blocked: 3 },
        { time: "24:00", allowed: 40, blocked: 1 },
      ];
      setData(dayData);
      
      // Calculate summary for day
      const dayTotal = dayData.reduce((sum, d) => sum + d.allowed + d.blocked, 0);
      const dayAllowed = dayData.reduce((sum, d) => sum + d.allowed, 0);
      const dayBlocked = dayData.reduce((sum, d) => sum + d.blocked, 0);
      setChartSummary({
        total: dayTotal,
        allowed: dayAllowed,
        blocked: dayBlocked,
        blockedPercent: dayTotal > 0 ? Math.round((dayBlocked / dayTotal) * 100 * 10) / 10 : 0
      });
    } else if (period === 'month') {
      // Daily data for a month (30 days)
      // Day total: ~475 allowed, ~32 blocked average
      // Show all days 1-30 with some variation
      const monthData = Array.from({ length: 30 }, (_, i) => {
        const day = i + 1;
        // Generate varied but realistic data for each day
        const baseAllowed = 400 + Math.floor(Math.random() * 200);
        // More variation in blocked: 3% to 12% of allowed, with some independent variation
        const blockedPercentage = 0.03 + Math.random() * 0.09;
        const baseBlocked = Math.floor(baseAllowed * blockedPercentage) + Math.floor(Math.random() * 15);
        return {
          time: day.toString(),
          allowed: baseAllowed,
          blocked: baseBlocked,
        };
      });
      setData(monthData);
      
      // Calculate summary for month
      const monthTotal = monthData.reduce((sum, d) => sum + d.allowed + d.blocked, 0);
      const monthAllowed = monthData.reduce((sum, d) => sum + d.allowed, 0);
      const monthBlocked = monthData.reduce((sum, d) => sum + d.blocked, 0);
      setChartSummary({
        total: monthTotal,
        allowed: monthAllowed,
        blocked: monthBlocked,
        blockedPercent: monthTotal > 0 ? Math.round((monthBlocked / monthTotal) * 100 * 10) / 10 : 0
      });
    } else if (period === 'year') {
      // Monthly data for a full year (Jan to Dec)
      // Average week: ~3680 allowed, ~248 blocked
      // Month should aggregate to roughly 4 weeks
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const yearData = months.map((month, i) => {
        // Base allowed varies by month
        const baseAllowed = 13000 + Math.floor(Math.random() * 6000);
        // More variation in blocked: 4% to 10% of allowed, with independent variation
        const blockedPercentage = 0.04 + Math.random() * 0.06;
        const baseBlocked = Math.floor(baseAllowed * blockedPercentage) + Math.floor(Math.random() * 200);
        return {
          time: month,
          allowed: baseAllowed,
          blocked: baseBlocked,
        };
      });
      setData(yearData);
      
      // Calculate summary for year
      const yearTotal = yearData.reduce((sum, d) => sum + d.allowed + d.blocked, 0);
      const yearAllowed = yearData.reduce((sum, d) => sum + d.allowed, 0);
      const yearBlocked = yearData.reduce((sum, d) => sum + d.blocked, 0);
      setChartSummary({
        total: yearTotal,
        allowed: yearAllowed,
        blocked: yearBlocked,
        blockedPercent: yearTotal > 0 ? Math.round((yearBlocked / yearTotal) * 100 * 10) / 10 : 0
      });
    }
  }

  // Update chart when time period changes
  useEffect(() => {
    updateChartData(chartTimePeriod);
  }, [chartTimePeriod, isAuthenticated]);

  async function loadData() {
    try {
      // Load agents count FIRST and update immediately
      const agentsResponse = await agents.list({ limit: 100 });
      const allAgents = agentsResponse.data || [];
      const activeAgentsCount = allAgents.filter((a: any) => a.status === 'active').length || 0;
      const totalAgentsCount = allAgents.length || 0;
      
      // Update agents count immediately (don't wait for audit data)
      setStats(prev => ({
        ...prev,
        agents: String(activeAgentsCount),
        totalAgents: String(totalAgentsCount),
      }));
      
      // Calculate date ranges for stats
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = last30Days.toISOString();
      
      // Aggregate audit events across all agents to get real stats
      let totalOperations = 0;
      let totalBlocked = 0;
      const recentEvents: any[] = [];
      
      // Fetch audit events for all agents
      const agentsToCheck = allAgents; // Check all agents
      
      for (const agent of agentsToCheck) {
        try {
          // Get ALL audit events for last 30 days (with pagination to handle >1000 events)
          let allAgentEvents: any[] = [];
          let offset = 0;
          const limit = 1000;
          let hasMore = true;
          
          while (hasMore) {
            const auditResponse = await audit.query(agent.agent_id, {
              start: startDate,
              limit: limit,
              offset: offset,
            });
            
            const events = auditResponse.events || [];
            allAgentEvents = allAgentEvents.concat(events);
            
            hasMore = auditResponse.total ? (allAgentEvents.length < auditResponse.total) : (events.length === limit);
            offset += limit;
            
            // Safety limit to avoid infinite loops
            if (offset > 10000) {
              console.warn(`Reached safety limit for agent ${agent.agent_id}`);
              break;
            }
          }
          
          totalOperations += allAgentEvents.length;
          
          // Count blocked operations
          const blocked = allAgentEvents.filter((e: any) => e.result === 'blocked' || e.result === 'Blocked').length;
          totalBlocked += blocked;
          
          // Collect recent events for activity feed (last 10 per agent)
          const recent = allAgentEvents
            .slice(0, 10)
            .map((e: any) => ({
              id: e.id || e.entry_id,
              action: e.action || e.event_type || 'Operation',
              agent: agent.name || agent.agent_id,
              status: e.result === 'blocked' || e.result === 'Blocked' ? 'Blocked' : 
                      e.result === 'allowed' || e.result === 'Allowed' ? 'Allowed' : 'Success',
              time: new Date(e.timestamp || e.created_at).toLocaleString(),
              hash: e.hash || e.entry_hash || 'N/A',
            }));
          
          recentEvents.push(...recent);
        } catch (error) {
          // If audit query fails for an agent, continue with others
          console.warn(`Failed to load audit for agent ${agent.agent_id}:`, error);
        }
      }
      
      // Sort recent events by time (most recent first) and take top 10
      recentEvents.sort((a, b) => {
        const timeA = new Date(a.time).getTime();
        const timeB = new Date(b.time).getTime();
        return timeB - timeA;
      });
      
      setRecentActivity(recentEvents.slice(0, 10));
      
      // Calculate data storage (mock for now - can be enhanced with actual data API)
      // In a real implementation, you'd query the data API to get total storage
      const estimatedStorageMB = Math.round((totalOperations * 0.5) / 1024); // Rough estimate: 0.5KB per operation
      const storageGB = (estimatedStorageMB / 1024).toFixed(1);
      const storageDisplay = estimatedStorageMB < 1024 
        ? `${estimatedStorageMB} MB` 
        : `${storageGB} GB`;
      
      // Calculate growth (mock: +8.2% for demo, in real app calculate from historical data)
      const growthPercent = totalOperations > 0 ? "+8.2%" : "0%";
      
      // Update stats with operations and blocked data (agents already updated above)
      setStats(prev => ({
        ...prev,
        operations: totalOperations.toLocaleString(),
        blocked: totalBlocked.toLocaleString(),
        dataStorage: storageDisplay,
        dataStorageGrowth: growthPercent,
      }));
      
      // Update chart data with real aggregated data
      // For now, show empty chart - can be enhanced to show time-series data
      setData([
        { time: "00:00", allowed: 0, blocked: 0 },
        { time: "04:00", allowed: 0, blocked: 0 },
        { time: "08:00", allowed: 0, blocked: 0 },
        { time: "12:00", allowed: 0, blocked: 0 },
        { time: "16:00", allowed: 0, blocked: 0 },
        { time: "20:00", allowed: 0, blocked: 0 },
        { time: "24:00", allowed: 0, blocked: 0 },
      ]);
      
      setChartSummary({
        total: totalOperations,
        allowed: totalOperations - totalBlocked,
        blocked: totalBlocked,
        blockedPercent: totalOperations > 0 ? Math.round((totalBlocked / totalOperations) * 100 * 10) / 10 : 0
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      // On error, show zeros instead of crashing
      setStats({
        operations: "0",
        blocked: "0",
        agents: "0",
        totalAgents: "0",
        verified: "100%",
        dataStorage: "0",
        dataStorageGrowth: "0%"
      });
    }
  }
  return (
    <Layout>
      <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-3">
            <button 
              onClick={() => !isAuthenticated && setIsSignInModalOpen(true)}
              className="bg-card border border-border hover:border-primary/50 px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" /> Export Report
            </button>
            <button 
              onClick={() => !isAuthenticated && setIsSignInModalOpen(true)}
              className="bg-primary hover:bg-primary-dark text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + New Agent
            </button>
          </div>
        </div>

        {/* Key Metrics Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Key Metrics</h2>
          </div>
          {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8">
          {[
            { title: "Active Agents", value: stats.agents, totalValue: stats.totalAgents, change: "0%", icon: Database, color: "text-secondary" },
            { title: "Governed Operations", value: stats.operations, change: isAuthenticated ? "+0%" : "+12%", icon: Activity, color: "text-primary" },
            { title: "Policy Violations Blocked", value: stats.blocked, change: isAuthenticated ? "+0%" : "+5%", icon: ShieldAlert, color: "text-destructive" },
            { title: "Data Storage", value: stats.dataStorage, change: stats.dataStorageGrowth, icon: HardDrive, color: "text-primary", showTrend: true },
          ].map((stat, i) => {
            // Determine color based on change value
            let changeColor = "text-primary"; // default blue for 0%
            if (stat.change.startsWith("+")) {
              changeColor = "text-green-500";
            } else if (stat.change.startsWith("-")) {
              changeColor = "text-red-500";
            } else if (stat.change === "0%") {
              changeColor = "text-primary";
            }
            
            return (
            <Card 
              key={i} 
              onClick={() => !isAuthenticated && setIsSignInModalOpen(true)}
              className="bg-card border border-border hover:border-primary/50 transition-all duration-200 group cursor-pointer"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stat.value}
                  {stat.totalValue && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      / {stat.totalValue}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {(stat as any).showTrend && stat.change.startsWith("+") && (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  )}
                  {(stat as any).showTrend && stat.change.startsWith("-") && (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={`${changeColor} font-medium`}>{stat.change}</span>
                  <span className="text-muted-foreground"> from last month</span>
                </p>
              </CardContent>
            </Card>
            );
          })}
        </div>
        </section>

        {/* Analytics Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
          </div>
          {/* Main Chart and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8">
          <Card 
            onClick={() => !isAuthenticated && setIsSignInModalOpen(true)}
            className="lg:col-span-2 bg-card border border-border cursor-pointer"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Operations: Allowed vs Blocked
                </CardTitle>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChartTimePeriod('day');
                    }}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      chartTimePeriod === 'day'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Day
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChartTimePeriod('month');
                    }}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      chartTimePeriod === 'month'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChartTimePeriod('year');
                    }}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      chartTimePeriod === 'year'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Year
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartTimePeriod === 'day' ? (
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="time" 
                        stroke="rgba(255,255,255,0.2)" 
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(20, 20, 30, 0.9)', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          backdropFilter: 'blur(10px)',
                          color: '#fff'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="allowed" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorAllowed)"
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-out"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="blocked" 
                        stroke="var(--destructive)" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorBlocked)"
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="20%">
                      <defs>
                        <linearGradient id="barColorAllowed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="barColorBlocked" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="time" 
                        stroke="rgba(255,255,255,0.2)" 
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(20, 20, 30, 0.9)', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          backdropFilter: 'blur(10px)',
                          color: '#fff'
                        }} 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          
                          // Find allowed and blocked values - ensure allowed comes first
                          const allowedPayload = payload.find(p => p.dataKey === 'allowed');
                          const blockedPayload = payload.find(p => p.dataKey === 'blocked');
                          
                          if (!allowedPayload || !blockedPayload) return null;
                          
                          // Match the day chart tooltip format exactly
                          return (
                            <div style={{
                              backgroundColor: 'rgba(20, 20, 30, 0.9)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              padding: '12px',
                              backdropFilter: 'blur(10px)',
                              color: '#fff'
                            }}>
                              <p style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '14px' }}>
                                {payload[0].payload.time}
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ color: '#10b981', fontSize: '14px' }}>
                                  allowed : {allowedPayload.value}
                                </div>
                                <div style={{ color: '#ef4444', fontSize: '14px' }}>
                                  blocked : {blockedPayload.value}
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar 
                        dataKey="blocked" 
                        stackId="a"
                        fill="url(#barColorBlocked)" 
                        stroke="var(--destructive)"
                        strokeWidth={1}
                        radius={[0, 0, 0, 0]}
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-out"
                      />
                      <Bar 
                        dataKey="allowed" 
                        stackId="a"
                        fill="url(#barColorAllowed)" 
                        stroke="#10b981"
                        strokeWidth={1}
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  {(() => {
                    const now = new Date();
                    if (chartTimePeriod === 'day') {
                      return now.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      });
                    } else if (chartTimePeriod === 'month') {
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      return `${firstDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                    } else if (chartTimePeriod === 'year') {
                      const firstDay = new Date(now.getFullYear(), 0, 1);
                      const lastDay = new Date(now.getFullYear(), 11, 31);
                      return `${firstDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                    }
                    return '';
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card 
            onClick={() => !isAuthenticated && setIsSignInModalOpen(true)}
            className="bg-card border border-border cursor-pointer"
          >
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-primary" />
                Recent Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <HistoryIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isAuthenticated ? "No recent activity. Operations will appear here." : "Sign in to view audit trail."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4" style={{ minHeight: '320px', height: '320px', overflow: 'hidden' }}>
                    {recentActivity.slice(0, 4).map((activity, index) => (
                      <div 
                        key={activity.id} 
                        className={`flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-all group cursor-pointer ${
                          index === 0 && !isAuthenticated ? 'animate-swipe-down' : ''
                        }`}
                        style={{
                          height: '60px', // Fixed height to prevent size changes
                          flexShrink: 0,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${activity.status === 'Allowed' || activity.status === 'Success' ? 'bg-green-500' : 'bg-destructive'} ${index === 0 && !isAuthenticated ? 'animate-pulse' : ''}`} />
                          <div>
                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              {activity.action}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {activity.agent} • {activity.time}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                            <Lock className="w-3 h-3" />
                            {activity.hash}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => !isAuthenticated && setIsSignInModalOpen(true)}
                    className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors border-t border-border"
                  >
                    View Full Audit Trail →
                  </button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        </section>
        
        {/* Sign In Modal */}
        <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
      </div>
    </Layout>
  );
}
