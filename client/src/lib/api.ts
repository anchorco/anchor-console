/**
 * API Client for Anchor Console
 * Handles all API communication with the Anchor backend
 */

export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5050'
    : 'https://api.getanchor.dev');

// Get API key from localStorage
export function getApiKey(): string | null {
  return localStorage.getItem('apiKey');
}

// Get API key ID from localStorage
export function getApiKeyId(): string | null {
  return localStorage.getItem('apiKeyId');
}

// Set API key in localStorage (and optionally store the key ID)
export function setApiKey(key: string, keyId?: string): void {
  localStorage.setItem('apiKey', key);
  if (keyId) {
    localStorage.setItem('apiKeyId', keyId);
  }
  // Dispatch custom event to notify components that API key was stored
  window.dispatchEvent(new Event('apiKeyStored'));
}

// Remove API key from localStorage
export function clearApiKey(): void {
  localStorage.removeItem('apiKey');
  localStorage.removeItem('apiKeyId');
}

// Get workspace ID from localStorage
export function getWorkspaceId(): string | null {
  return localStorage.getItem('workspaceId');
}

// Set workspace ID in localStorage
export function setWorkspaceId(workspaceId: string): void {
  localStorage.setItem('workspaceId', workspaceId);
}

// Make API request
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Always add API key if available (after merging other headers to ensure it's not overridden)
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  // Add /v1 prefix to all API endpoints (except auth endpoints which don't use /v1)
  // Auth endpoints: /auth/*, /api-keys (all API key operations), /workspaces
  const isAuthEndpoint = endpoint.startsWith('/auth/') || 
                         endpoint.startsWith('/api-keys') || 
                         endpoint.startsWith('/workspaces');
  
  const prefixedEndpoint = isAuthEndpoint ? endpoint : `/v1${endpoint}`;
  const url = `${API_BASE_URL}${prefixedEndpoint}`;
  
  // workspaceId is now handled automatically by the API based on the API key
  // No need to inject it into requests
  const requestBody = options.body;

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      body: requestBody, // Use modified body if workspaceId was added
      headers,
      signal: controller.signal,
      credentials: 'include',  // Include cookies for session-based auth
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch {
        error = { error: response.statusText, message: response.statusText };
      }
      const errorMessage = error.message || error.error || `HTTP ${response.status}`;
      console.error('[API] Request failed:', {
        url,
        status: response.status,
        statusText: response.statusText,
        error
      });
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - is the backend server running?');
    }
    // Log network errors for debugging
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      console.error('[API] Network error:', {
        url,
        error: error.message,
        name: error.name,
        stack: error.stack
      });
      throw new Error(`Network error: ${error.message}. Is the backend server running at ${API_BASE_URL}?`);
    }
    throw error;
  }
}

// ==================== Authentication ====================

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

export interface SignupResponse {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  workspace?: Workspace;
  apiKey?: ApiKey;
  key?: string;  // Plain API key (only returned once)
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

export const auth = {
  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    return apiRequest<SignupResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login: async (data: LoginRequest): Promise<{ user: User; workspaces?: Workspace[]; workspace?: Workspace; apiKeys?: ApiKey[]; apiKey?: ApiKey; key?: string; message?: string }> => {
    return apiRequest<{ user: User; workspaces?: Workspace[]; workspace?: Workspace; apiKeys?: ApiKey[]; apiKey?: ApiKey; key?: string; message?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    return apiRequest<{ user: User }>('/auth/me');
  },

  logout: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  updateUser: async (data: { name?: string }): Promise<{ user: User }> => {
    return apiRequest<{ user: User }>('/auth/user', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ==================== Workspaces ====================

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export const workspaces = {
  list: async (): Promise<{ workspaces: Workspace[] }> => {
    return apiRequest<{ workspaces: Workspace[] }>('/workspaces');
  },

  create: async (data: CreateWorkspaceRequest): Promise<{ workspace: Workspace }> => {
    return apiRequest<{ workspace: Workspace }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ==================== API Keys ====================

export interface ApiKey {
  id: string;
  name?: string;
  workspaceId?: string;  // camelCase to match backend
  createdAt: string;  // camelCase to match backend
  lastUsedAt?: string;  // camelCase to match backend
  expiresAt?: string;  // camelCase to match backend
}

export interface CreateApiKeyRequest {
  email: string;
  name?: string;
  expiresInDays?: number;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  key: string; // Plain key - only shown once!
  warning: string;
}

export const apiKeys = {
  create: async (data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> => {
    return apiRequest<CreateApiKeyResponse>('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  list: async (): Promise<{ apiKeys: ApiKey[] }> => {
    return apiRequest<{ apiKeys: ApiKey[] }>('/api-keys');
  },

  revoke: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/api-keys/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== Agents ====================

export interface Agent {
  agent_id: string;
  name: string;
  description?: string;
  owner?: string;
  team?: string;
  config?: Record<string, any>;
  tags?: string[];
  memory_policy?: Record<string, any>;
  model_policy?: Record<string, any>;
  status: 'active' | 'suspended' | 'deleted';
  version: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  owner?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  owner?: string;
  team?: string;
  config?: Record<string, any>;
  tags?: string[];
  memoryPolicy?: Record<string, any>;
  modelPolicy?: Record<string, any>;
}

export interface AgentConfig {
  agent_id: string;
  version: string;
  config: Record<string, any>;
  created_at: string;
  created_by?: string;
}

export interface ConfigVersion {
  version: string;
  created_at: string;
  created_by?: string;
}

export const agents = {
  list: async (params?: { status?: string; owner?: string; limit?: number }): Promise<{ data: Agent[]; has_more?: boolean; total?: number }> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.owner) query.append('owner', params.owner);
    if (params?.limit) query.append('limit', params.limit.toString());
    const queryString = query.toString();
    const response = await apiRequest<{ data: Agent[]; has_more?: boolean; total?: number }>(`/agents${queryString ? `?${queryString}` : ''}`);
    // Support both new format (data) and old format (agents) for backward compatibility
    if ('data' in response) {
      return response;
    }
    // Old format - wrap in data
    return { data: (response as any).agents || [], has_more: false, total: (response as any).agents?.length || 0 };
  },

  get: async (agentId: string): Promise<{ agent: Agent }> => {
    return apiRequest<{ agent: Agent }>(`/agents/${agentId}`);
  },

  create: async (data: CreateAgentRequest): Promise<{ agent: Agent }> => {
    // Map metadata to config for backend compatibility
    // The documented API uses 'metadata', but backend expects 'config'
    const requestBody: any = { ...data };
    if (requestBody.metadata) {
      requestBody.config = requestBody.metadata;
      delete requestBody.metadata;
    }
    return apiRequest<{ agent: Agent }>('/agents', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  update: async (agentId: string, data: UpdateAgentRequest): Promise<{ agent: Agent }> => {
    return apiRequest<{ agent: Agent }>(`/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  suspend: async (agentId: string): Promise<{ agent: Agent }> => {
    return apiRequest<{ agent: Agent }>(`/agents/${agentId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({}), // Empty body required when Content-Type is application/json
    });
  },

  activate: async (agentId: string): Promise<{ agent: Agent }> => {
    return apiRequest<{ agent: Agent }>(`/agents/${agentId}/activate`, {
      method: 'POST',
      body: JSON.stringify({}), // Empty body required when Content-Type is application/json
    });
  },

  delete: async (agentId: string): Promise<{ success: boolean; agent: Agent }> => {
    return apiRequest<{ success: boolean; agent: Agent }>(`/agents/${agentId}`, {
      method: 'DELETE',
      body: JSON.stringify({}), // Empty body required when Content-Type is application/json
    });
  },

  // Config management
  getConfig: async (agentId: string): Promise<AgentConfig> => {
    return apiRequest<AgentConfig>(`/agents/${agentId}/config`);
  },

  updateConfig: async (agentId: string, config: Record<string, any>): Promise<AgentConfig> => {
    return apiRequest<AgentConfig>(`/agents/${agentId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  getConfigVersions: async (agentId: string, limit?: number): Promise<{ data: ConfigVersion[]; has_more?: boolean; total?: number }> => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await apiRequest<{ data: ConfigVersion[]; has_more?: boolean; total?: number }>(`/agents/${agentId}/config/versions${query}`);
    // Support both new format (data) and old format (versions) for backward compatibility
    if ('data' in response) {
      return response;
    }
    // Old format - wrap in data
    return { data: (response as any).versions || [], has_more: false, total: (response as any).versions?.length || 0 };
  },

  getConfigVersion: async (agentId: string, version: string): Promise<AgentConfig> => {
    return apiRequest<AgentConfig>(`/agents/${agentId}/config/versions/${version}`);
  },

  rollbackConfig: async (agentId: string, targetVersion: string): Promise<AgentConfig> => {
    return apiRequest<AgentConfig>(`/agents/${agentId}/config/rollback`, {
      method: 'POST',
      body: JSON.stringify({ target_version: targetVersion }),
    });
  },
};

// ==================== Data (Memory) ====================

export interface DataEntry {
  key: string;
  value: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  audit_id: string;
}

export interface WriteDataRequest {
  key: string;
  value: string;
  metadata?: Record<string, any>;
}

export interface WriteDataResponse {
  key: string;
  allowed: boolean;
  audit_id: string;
  blocked_by?: string;
  reason?: string;
  expires_at?: string;
  created_at?: string;
}

export interface SearchDataRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

export interface SearchDataResult {
  key: string;
  value: string;
  similarity: number;
  metadata: Record<string, any>;
}

export const data = {
  write: async (agentId: string, data: WriteDataRequest): Promise<WriteDataResponse> => {
    return apiRequest<WriteDataResponse>(`/agents/${agentId}/data`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  read: async (agentId: string, key: string): Promise<{ entry: DataEntry }> => {
    return apiRequest<{ entry: DataEntry }>(`/agents/${agentId}/data/${encodeURIComponent(key)}`);
  },

  readFull: async (agentId: string, key: string): Promise<{ entry: DataEntry }> => {
    return apiRequest<{ entry: DataEntry }>(`/agents/${agentId}/data/${encodeURIComponent(key)}/full`);
  },

  delete: async (agentId: string, key: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/agents/${agentId}/data/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  },

  deletePrefix: async (agentId: string, prefix: string): Promise<{ deleted: number }> => {
    return apiRequest<{ deleted: number }>(`/agents/${agentId}/data/prefix/${encodeURIComponent(prefix)}`, {
      method: 'DELETE',
    });
  },

  list: async (agentId: string, params?: { prefix?: string; limit?: number; cursor?: string; full?: boolean }): Promise<{
    data: DataEntry[];
    has_more?: boolean;
    total?: number;
    next_cursor?: string;
  }> => {
    const query = new URLSearchParams();
    if (params?.prefix) query.append('prefix', params.prefix);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.cursor) query.append('cursor', params.cursor);
    if (params?.full) query.append('full', 'true');
    const queryString = query.toString();
    const response = await apiRequest<{ data: DataEntry[]; has_more?: boolean; total?: number; next_cursor?: string }>(`/agents/${agentId}/data${queryString ? `?${queryString}` : ''}`);
    // Support both new format (data) and old format (entries) for backward compatibility
    if ('data' in response) {
      return response;
    }
    // Old format - wrap in data
    return { data: (response as any).entries || [], has_more: false, total: (response as any).entries?.length || 0, next_cursor: (response as any).next_cursor };
  },

  search: async (agentId: string, params: SearchDataRequest): Promise<{ results: SearchDataResult[] }> => {
    return apiRequest<{ results: SearchDataResult[] }>(`/agents/${agentId}/data/search`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

// ==================== Audit ====================

export interface AuditEvent {
  id: string;
  agent_id: string;
  operation: string;
  resource: string;
  result: 'allowed' | 'blocked' | 'success';
  blocked_by?: string;
  timestamp: string;
  hash: string;
  previous_hash?: string;
  metadata?: Record<string, any>;
}

export interface AuditQueryParams {
  operations?: string;
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

export interface AuditResponse {
  events: AuditEvent[];
  total: number;
  chain_start?: string;
  chain_end?: string;
}

export interface Verification {
  valid: boolean;
  events_checked: number;
  chain_start?: string;
  chain_end?: string;
  verified_at: string;
  time_range?: {
    start: string;
    end: string;
  };
  first_invalid?: {
    id: string;
    timestamp: string;
    expected_previous_hash: string;
    actual_previous_hash: string;
  };
}

export interface ExportRequest {
  format?: 'json' | 'csv';
  start?: string;
  end?: string;
  include_verification?: boolean;
}

export interface ExportResponse {
  export_id: string;
  format: string;
  download_url: string;
  expires_at: string;
  event_count: number;
  verification?: Verification;
}

export const audit = {
  query: async (agentId: string, params?: AuditQueryParams): Promise<AuditResponse> => {
    const query = new URLSearchParams();
    if (params?.operations) query.append('operations', params.operations);
    if (params?.start) query.append('start', params.start);
    if (params?.end) query.append('end', params.end);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    const queryString = query.toString();
    const response = await apiRequest<{ data: AuditEvent[]; has_more?: boolean; total?: number; chain_start?: string; chain_end?: string }>(`/agents/${agentId}/audit${queryString ? `?${queryString}` : ''}`);
    // Support both new format (data) and old format (events) for backward compatibility
    if ('data' in response) {
      return {
        events: response.data,
        total: response.total || response.data.length,
        chain_start: response.chain_start,
        chain_end: response.chain_end,
      };
    }
    // Old format
    return response as AuditResponse;
  },

  get: async (agentId: string, auditId: string): Promise<AuditEvent> => {
    return apiRequest<AuditEvent>(`/agents/${agentId}/audit/${auditId}`);
  },

  verify: async (agentId: string, start?: string): Promise<Verification> => {
    const query = start ? `?start=${start}` : '';
    return apiRequest<Verification>(`/agents/${agentId}/audit/verify${query}`);
  },

  export: async (agentId: string, params?: ExportRequest): Promise<ExportResponse> => {
    return apiRequest<ExportResponse>(`/agents/${agentId}/audit/export`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  },
};

// ==================== Policies ====================

export interface Policy {
  id?: string;
  subjectPrefix: string;
  doNotStore?: boolean;
  allowTypes?: {
    profile?: boolean;
    episodic?: boolean;
    semantic?: boolean;
    procedural?: boolean;
  };
  piiMode?: 'block' | 'allow' | 'redact';
  retentionDays?: number | null;
  updatedAt?: string;
}

export interface UpdatePolicyRequest {
  subjectPrefix?: string;
  doNotStore?: boolean;
  allowTypes?: {
    profile?: boolean;
    episodic?: boolean;
    semantic?: boolean;
    procedural?: boolean;
  };
  piiMode?: 'block' | 'allow' | 'redact';
  retentionDays?: number | null;
}

export const policies = {
  get: async (subjectPrefix?: string): Promise<Policy> => {
    const query = subjectPrefix ? `?subjectPrefix=${encodeURIComponent(subjectPrefix)}` : '';
    return apiRequest<Policy>(`/policy${query}`);
  },

  list: async (): Promise<{ policies: Policy[] }> => {
    return apiRequest<{ policies: Policy[] }>('/policy/list');
  },

  update: async (data: UpdatePolicyRequest): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>('/policy', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ==================== Checkpoints ====================

export interface Checkpoint {
  checkpoint_id: string;
  agent_id: string;
  label?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CreateCheckpointRequest {
  label?: string;
  metadata?: Record<string, any>;
}

export const checkpoints = {
  create: async (agentId: string, data?: CreateCheckpointRequest): Promise<{ checkpoint: Checkpoint }> => {
    return apiRequest<{ checkpoint: Checkpoint }>(`/agents/${agentId}/checkpoints`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  list: async (agentId: string): Promise<{ data: Checkpoint[]; has_more?: boolean; total?: number }> => {
    const response = await apiRequest<{ data: Checkpoint[]; has_more?: boolean; total?: number }>(`/agents/${agentId}/checkpoints`);
    // Support both new format (data) and old format (checkpoints) for backward compatibility
    if ('data' in response) {
      return response;
    }
    // Old format - wrap in data
    return { data: (response as any).checkpoints || [], has_more: false, total: (response as any).checkpoints?.length || 0 };
  },

  get: async (agentId: string, checkpointId: string): Promise<{ checkpoint: Checkpoint }> => {
    return apiRequest<{ checkpoint: Checkpoint }>(`/agents/${agentId}/checkpoints/${checkpointId}`);
  },

  restore: async (agentId: string, checkpointId: string): Promise<{ restored: number }> => {
    return apiRequest<{ restored: number }>(`/agents/${agentId}/checkpoints/${checkpointId}/restore`, {
      method: 'POST',
    });
  },

  delete: async (agentId: string, checkpointId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/agents/${agentId}/checkpoints/${checkpointId}`, {
      method: 'DELETE',
    });
  },
};

