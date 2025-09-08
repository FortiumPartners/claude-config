export interface DatabaseSchema {
    organizations: {
        id: string;
        name: string;
        slug: string;
        settings: any;
        created_at: Date;
        updated_at: Date;
    };
    users: {
        id: string;
        organization_id: string;
        email: string;
        password_hash: string;
        role: 'owner' | 'admin' | 'manager' | 'developer';
        profile: any;
        last_login: Date | null;
        created_at: Date;
        updated_at: Date;
    };
    teams: {
        id: string;
        organization_id: string;
        name: string;
        description: string | null;
        created_at: Date;
        updated_at: Date;
    };
    team_memberships: {
        user_id: string;
        team_id: string;
        role: 'lead' | 'member';
        created_at: Date;
    };
    metrics_events: {
        id: string;
        organization_id: string;
        user_id: string;
        event_type: string;
        event_data: any;
        session_id: string | null;
        claude_version: string | null;
        agent_used: string | null;
        timestamp: Date;
        created_at: Date;
    };
    user_sessions: {
        id: string;
        user_id: string;
        session_token: string;
        expires_at: Date;
        last_activity: Date;
        ip_address: string | null;
        user_agent: string | null;
        created_at: Date;
    };
    refresh_tokens: {
        jti: string;
        user_id: string;
        organization_id: string;
        token_family: string;
        expires_at: Date;
        created_at: Date;
    };
    token_blacklist: {
        jti: string;
        expires_at: Date;
        created_at: Date;
    };
}
export type UserRole = DatabaseSchema['users']['role'];
export type TeamRole = DatabaseSchema['team_memberships']['role'];
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number;
}
//# sourceMappingURL=schema.d.ts.map