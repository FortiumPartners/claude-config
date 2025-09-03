import { DatabaseConnection } from './connection';
import { securityConfig } from './config';

export class DatabasePolicies {
  constructor(private db: DatabaseConnection) {}

  async createRoles(): Promise<void> {
    await this.db.query(`
      -- Create application roles
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metrics_app_read') THEN
          CREATE ROLE metrics_app_read;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metrics_app_write') THEN
          CREATE ROLE metrics_app_write;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metrics_app_admin') THEN
          CREATE ROLE metrics_app_admin;
        END IF;
      END
      $$;
    `);
  }

  async enableRLS(): Promise<void> {
    if (!securityConfig.enableRLS) {
      console.log('RLS is disabled in configuration, skipping policy creation');
      return;
    }

    const tables = [
      'organizations',
      'users', 
      'teams',
      'team_members',
      'projects',
      'command_executions',
      'agent_interactions',
      'user_sessions',
      'productivity_metrics',
    ];

    for (const table of tables) {
      await this.db.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }
  }

  async createOrganizationPolicies(): Promise<void> {
    // Organizations table policies
    await this.db.query(`
      -- Admin can see all organizations
      CREATE POLICY org_admin_all ON organizations
        FOR ALL TO metrics_app_admin
        USING (true);
      
      -- Users can only see their own organization
      CREATE POLICY org_user_select ON organizations
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (id = current_setting('app.current_organization_id', true)::uuid);
      
      -- Only admins can modify organizations
      CREATE POLICY org_admin_modify ON organizations
        FOR ALL TO metrics_app_admin
        USING (true);
    `);
  }

  async createUserPolicies(): Promise<void> {
    await this.db.query(`
      -- Users can see other users in their organization
      CREATE POLICY users_select ON users
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      -- Users can update their own profile
      CREATE POLICY users_update_self ON users
        FOR UPDATE TO metrics_app_write
        USING (id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (id = current_setting('app.current_user_id', true)::uuid);
      
      -- Admins can modify all users in their organization
      CREATE POLICY users_admin_modify ON users
        FOR ALL TO metrics_app_admin
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
    `);
  }

  async createTeamPolicies(): Promise<void> {
    await this.db.query(`
      -- Users can see teams in their organization
      CREATE POLICY teams_select ON teams
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      -- Team admins and org admins can modify teams
      CREATE POLICY teams_modify ON teams
        FOR ALL TO metrics_app_write, metrics_app_admin
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
    `);
  }

  async createTeamMemberPolicies(): Promise<void> {
    await this.db.query(`
      -- Users can see team memberships in their organization
      CREATE POLICY team_members_select ON team_members
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      -- Team admins and org admins can modify team memberships
      CREATE POLICY team_members_modify ON team_members
        FOR ALL TO metrics_app_write, metrics_app_admin
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
    `);
  }

  async createProjectPolicies(): Promise<void> {
    await this.db.query(`
      -- Users can see projects in their organization
      CREATE POLICY projects_select ON projects
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      -- Users can create projects in their organization
      CREATE POLICY projects_insert ON projects
        FOR INSERT TO metrics_app_write
        WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      -- Project team members and admins can modify projects
      CREATE POLICY projects_modify ON projects
        FOR UPDATE TO metrics_app_write, metrics_app_admin
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
    `);
  }

  async createMetricsPolicies(): Promise<void> {
    await this.db.query(`
      -- Command executions policies
      CREATE POLICY command_executions_select ON command_executions
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      CREATE POLICY command_executions_insert ON command_executions
        FOR INSERT TO metrics_app_write
        WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      -- Agent interactions policies  
      CREATE POLICY agent_interactions_select ON agent_interactions
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      CREATE POLICY agent_interactions_insert ON agent_interactions
        FOR INSERT TO metrics_app_write
        WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      -- User sessions policies
      CREATE POLICY user_sessions_select ON user_sessions
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      CREATE POLICY user_sessions_insert ON user_sessions
        FOR INSERT TO metrics_app_write
        WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      CREATE POLICY user_sessions_update ON user_sessions
        FOR UPDATE TO metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      -- Productivity metrics policies
      CREATE POLICY productivity_metrics_select ON productivity_metrics
        FOR SELECT TO metrics_app_read, metrics_app_write
        USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
      
      CREATE POLICY productivity_metrics_insert ON productivity_metrics
        FOR INSERT TO metrics_app_write
        WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
    `);
  }

  async createPersonalDataPolicies(): Promise<void> {
    await this.db.query(`
      -- Users can only see their own detailed metrics unless they're managers/admins
      CREATE POLICY personal_command_executions ON command_executions
        FOR SELECT TO metrics_app_read
        USING (
          organization_id = current_setting('app.current_organization_id', true)::uuid AND
          (
            user_id = current_setting('app.current_user_id', true)::uuid OR
            EXISTS (
              SELECT 1 FROM users u 
              WHERE u.id = current_setting('app.current_user_id', true)::uuid 
              AND u.role IN ('admin', 'manager')
            )
          )
        );
      
      CREATE POLICY personal_agent_interactions ON agent_interactions
        FOR SELECT TO metrics_app_read
        USING (
          organization_id = current_setting('app.current_organization_id', true)::uuid AND
          (
            user_id = current_setting('app.current_user_id', true)::uuid OR
            EXISTS (
              SELECT 1 FROM users u 
              WHERE u.id = current_setting('app.current_user_id', true)::uuid 
              AND u.role IN ('admin', 'manager')
            )
          )
        );
      
      CREATE POLICY personal_user_sessions ON user_sessions
        FOR SELECT TO metrics_app_read
        USING (
          organization_id = current_setting('app.current_organization_id', true)::uuid AND
          (
            user_id = current_setting('app.current_user_id', true)::uuid OR
            EXISTS (
              SELECT 1 FROM users u 
              WHERE u.id = current_setting('app.current_user_id', true)::uuid 
              AND u.role IN ('admin', 'manager')
            )
          )
        );
    `);
  }

  async grantPermissions(): Promise<void> {
    await this.db.query(`
      -- Grant basic permissions to read role
      GRANT USAGE ON SCHEMA public TO metrics_app_read;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO metrics_app_read;
      
      -- Grant write permissions to write role  
      GRANT USAGE ON SCHEMA public TO metrics_app_write;
      GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO metrics_app_write;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO metrics_app_write;
      
      -- Grant admin permissions
      GRANT USAGE ON SCHEMA public TO metrics_app_admin;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO metrics_app_admin;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO metrics_app_admin;
      
      -- Grant TimescaleDB permissions
      GRANT SELECT ON _timescaledb_catalog.hypertable TO metrics_app_read, metrics_app_write, metrics_app_admin;
      GRANT SELECT ON _timescaledb_catalog.chunk TO metrics_app_read, metrics_app_write, metrics_app_admin;
    `);
  }

  async createSecurityFunctions(): Promise<void> {
    await this.db.query(`
      -- Function to get current organization ID with validation
      CREATE OR REPLACE FUNCTION get_current_organization_id()
      RETURNS UUID AS $$
      DECLARE
        org_id UUID;
      BEGIN
        org_id := current_setting('app.current_organization_id', true)::uuid;
        
        IF org_id IS NULL THEN
          RAISE EXCEPTION 'Organization context not set';
        END IF;
        
        RETURN org_id;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Invalid organization ID format';
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Function to validate user belongs to organization
      CREATE OR REPLACE FUNCTION validate_user_organization(user_uuid UUID, org_uuid UUID)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM users 
          WHERE id = user_uuid 
          AND organization_id = org_uuid 
          AND deleted_at IS NULL
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Function to check if user has role permissions
      CREATE OR REPLACE FUNCTION user_has_role(user_uuid UUID, required_role TEXT)
      RETURNS BOOLEAN AS $$
      DECLARE
        user_role TEXT;
      BEGIN
        SELECT role INTO user_role FROM users WHERE id = user_uuid;
        
        RETURN CASE 
          WHEN required_role = 'admin' THEN user_role = 'admin'
          WHEN required_role = 'manager' THEN user_role IN ('admin', 'manager')
          WHEN required_role = 'developer' THEN user_role IN ('admin', 'manager', 'developer')
          WHEN required_role = 'viewer' THEN user_role IN ('admin', 'manager', 'developer', 'viewer')
          ELSE false
        END;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
  }

  async dropPolicies(): Promise<void> {
    const tables = [
      'organizations',
      'users',
      'teams', 
      'team_members',
      'projects',
      'command_executions',
      'agent_interactions',
      'user_sessions',
      'productivity_metrics',
    ];

    for (const table of tables) {
      await this.db.query(`DROP POLICY IF EXISTS org_admin_all ON ${table}`);
      await this.db.query(`DROP POLICY IF EXISTS org_user_select ON ${table}`);
      await this.db.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }
  }

  async initializePolicies(): Promise<void> {
    try {
      await this.createRoles();
      await this.enableRLS();
      await this.createOrganizationPolicies();
      await this.createUserPolicies();
      await this.createTeamPolicies();
      await this.createTeamMemberPolicies();
      await this.createProjectPolicies();
      await this.createMetricsPolicies();
      await this.createPersonalDataPolicies();
      await this.createSecurityFunctions();
      await this.grantPermissions();
      
      console.log('Database security policies initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database policies:', error);
      throw error;
    }
  }
}
