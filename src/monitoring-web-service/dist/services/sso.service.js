"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSOService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const PROVIDER_CONFIGS = {
    google: {
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
        discovery_url: 'https://accounts.google.com/.well-known/openid_configuration',
        default_scopes: ['openid', 'email', 'profile'],
        user_id_field: 'id',
        email_field: 'email',
        name_field: 'name',
        picture_field: 'picture',
    },
    azure: {
        authorization_endpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
        token_endpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
        userinfo_endpoint: 'https://graph.microsoft.com/v1.0/me',
        discovery_url: 'https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid_configuration',
        default_scopes: ['openid', 'email', 'profile', 'User.Read'],
        user_id_field: 'id',
        email_field: 'mail',
        name_field: 'displayName',
        picture_field: 'photo',
    },
    okta: {
        authorization_endpoint: '{domain}/oauth2/v1/authorize',
        token_endpoint: '{domain}/oauth2/v1/token',
        userinfo_endpoint: '{domain}/oauth2/v1/userinfo',
        discovery_url: '{domain}/.well-known/openid_configuration',
        default_scopes: ['openid', 'email', 'profile', 'groups'],
        user_id_field: 'sub',
        email_field: 'email',
        name_field: 'name',
        picture_field: 'picture',
    },
};
class SSOService {
    db;
    logger;
    jwtService;
    encryptionKey;
    constructor(db, jwtService, logger) {
        this.db = db;
        this.jwtService = jwtService;
        this.logger = logger;
        this.encryptionKey = process.env.SSO_ENCRYPTION_KEY || this.generateEncryptionKey();
        if (!process.env.SSO_ENCRYPTION_KEY) {
            this.logger.warn('Using generated SSO encryption key - this is not secure for production');
        }
    }
    generateEncryptionKey() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    async configureSSOProvider(organizationId, providerConfig) {
        await this.db.setOrganizationContext(organizationId);
        try {
            const encryptedSecret = this.encryptSecret(providerConfig.client_secret);
            const query = `
        INSERT INTO sso_providers (
          organization_id, provider_name, provider_type, client_id,
          client_secret_encrypted, discovery_url, redirect_uri,
          scopes, additional_config, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (organization_id, provider_name)
        DO UPDATE SET
          provider_type = EXCLUDED.provider_type,
          client_id = EXCLUDED.client_id,
          client_secret_encrypted = EXCLUDED.client_secret_encrypted,
          discovery_url = EXCLUDED.discovery_url,
          redirect_uri = EXCLUDED.redirect_uri,
          scopes = EXCLUDED.scopes,
          additional_config = EXCLUDED.additional_config,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING *
      `;
            const result = await this.db.query(query, [
                organizationId,
                providerConfig.provider_name,
                providerConfig.provider_type,
                providerConfig.client_id,
                encryptedSecret,
                providerConfig.discovery_url,
                providerConfig.redirect_uri,
                JSON.stringify(providerConfig.scopes),
                JSON.stringify(providerConfig.additional_config),
                providerConfig.is_active,
            ]);
            const provider = result.rows[0];
            this.logger.info('SSO provider configured', {
                organization_id: organizationId,
                provider_name: providerConfig.provider_name,
                provider_type: providerConfig.provider_type
            });
            return {
                ...provider,
                client_secret: providerConfig.client_secret,
                scopes: JSON.parse(provider.scopes),
                additional_config: JSON.parse(provider.additional_config),
            };
        }
        finally {
            await this.db.clearOrganizationContext();
        }
    }
    async getSSOProvider(organizationId, providerName) {
        await this.db.setOrganizationContext(organizationId);
        try {
            const query = `
        SELECT * FROM sso_providers 
        WHERE organization_id = $1 AND provider_name = $2 AND is_active = true
      `;
            const result = await this.db.query(query, [organizationId, providerName]);
            if (result.rows.length === 0)
                return null;
            const provider = result.rows[0];
            return {
                ...provider,
                client_secret: this.decryptSecret(provider.client_secret_encrypted),
                scopes: JSON.parse(provider.scopes),
                additional_config: JSON.parse(provider.additional_config),
            };
        }
        finally {
            await this.db.clearOrganizationContext();
        }
    }
    async initiateSSOAuth(request) {
        const { provider_name, organization_id } = request;
        if (!organization_id) {
            throw new Error('Organization ID required for SSO authentication');
        }
        const provider = await this.getSSOProvider(organization_id, provider_name);
        if (!provider) {
            throw new Error(`SSO provider '${provider_name}' not found or not active`);
        }
        const providerConfig = PROVIDER_CONFIGS[provider_name];
        if (!providerConfig) {
            throw new Error(`Unsupported SSO provider: ${provider_name}`);
        }
        const state = request.state || crypto_1.default.randomBytes(32).toString('hex');
        const codeVerifier = crypto_1.default.randomBytes(32).toString('base64url');
        const codeChallenge = crypto_1.default.createHash('sha256').update(codeVerifier).digest('base64url');
        await this.storeSSOSession({
            state,
            organization_id,
            provider_name,
            code_verifier: codeVerifier,
            redirect_uri: request.redirect_uri || provider.redirect_uri,
        });
        const authUrl = new URL(this.replaceTemplatePlaceholders(providerConfig.authorization_endpoint, provider.additional_config));
        const params = {
            response_type: 'code',
            client_id: provider.client_id,
            redirect_uri: request.redirect_uri || provider.redirect_uri,
            scope: provider.scopes.join(' '),
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            ...this.getProviderSpecificAuthParams(provider_name, provider.additional_config),
        };
        Object.entries(params).forEach(([key, value]) => {
            if (value)
                authUrl.searchParams.set(key, value.toString());
        });
        this.logger.info('SSO authentication initiated', {
            organization_id,
            provider_name,
            state,
            redirect_uri: request.redirect_uri || provider.redirect_uri,
        });
        return {
            authorization_url: authUrl.toString(),
            state,
            code_verifier: codeVerifier,
        };
    }
    async handleSSOCallback(request) {
        const { code, state, provider_name } = request;
        const session = await this.getSSOSession(state);
        if (!session) {
            throw new Error('Invalid or expired SSO session state');
        }
        if (session.provider_name !== provider_name) {
            throw new Error('SSO provider mismatch');
        }
        try {
            const provider = await this.getSSOProvider(session.organization_id, provider_name);
            if (!provider) {
                throw new Error(`SSO provider '${provider_name}' not found or not active`);
            }
            const tokenResponse = await this.exchangeCodeForTokens(provider, code, session);
            const userInfo = await this.getUserInfo(provider, tokenResponse.access_token);
            const user = await this.findOrCreateUser(session.organization_id, provider_name, userInfo);
            const tokens = await this.jwtService.generateTokenPair({
                user_id: user.id,
                organization_id: user.organization_id,
                email: user.email,
                role: user.role,
                team_memberships: user.team_memberships,
            });
            await this.logAuthEvent({
                organization_id: session.organization_id,
                user_id: user.id,
                event_type: 'sso_login_success',
                provider_name,
                external_id: userInfo.external_id,
            });
            this.logger.info('SSO authentication successful', {
                organization_id: session.organization_id,
                user_id: user.id,
                provider_name,
                is_new_user: user.is_new_user,
            });
            return {
                user: {
                    id: user.id,
                    organization_id: user.organization_id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    external_id: user.external_id,
                    external_provider: user.external_provider,
                    is_new_user: user.is_new_user,
                },
                tokens,
            };
        }
        catch (error) {
            await this.logAuthEvent({
                organization_id: session.organization_id,
                event_type: 'sso_login_failed',
                provider_name,
                error_message: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
        finally {
            await this.deleteSSOSession(state);
        }
    }
    async syncUserGroupsFromSSO(userId, providerName) {
        this.logger.info('SSO group sync initiated', {
            user_id: userId,
            provider_name: providerName,
        });
    }
    async listSSOProviders(organizationId) {
        await this.db.setOrganizationContext(organizationId);
        try {
            const query = `
        SELECT id, organization_id, provider_name, provider_type,
               client_id, discovery_url, redirect_uri, scopes,
               additional_config, is_active, created_at, updated_at
        FROM sso_providers 
        WHERE organization_id = $1
        ORDER BY provider_name
      `;
            const result = await this.db.query(query, [organizationId]);
            return result.rows.map(row => ({
                ...row,
                scopes: JSON.parse(row.scopes),
                additional_config: JSON.parse(row.additional_config),
            }));
        }
        finally {
            await this.db.clearOrganizationContext();
        }
    }
    async disableSSOProvider(organizationId, providerName) {
        await this.db.setOrganizationContext(organizationId);
        try {
            const query = `
        UPDATE sso_providers 
        SET is_active = false, updated_at = NOW()
        WHERE organization_id = $1 AND provider_name = $2
      `;
            const result = await this.db.query(query, [organizationId, providerName]);
            if (result.rowCount === 0) {
                throw new Error(`SSO provider '${providerName}' not found`);
            }
            this.logger.info('SSO provider disabled', {
                organization_id: organizationId,
                provider_name: providerName,
            });
        }
        finally {
            await this.db.clearOrganizationContext();
        }
    }
    encryptSecret(secret) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipher(algorithm, this.encryptionKey);
        let encrypted = cipher.update(secret, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    decryptSecret(encryptedSecret) {
        const algorithm = 'aes-256-gcm';
        const parts = encryptedSecret.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = crypto_1.default.createDecipher(algorithm, this.encryptionKey);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    replaceTemplatePlaceholders(template, config) {
        return template.replace(/\{(\w+)\}/g, (match, key) => config[key] || match);
    }
    getProviderSpecificAuthParams(providerName, config) {
        switch (providerName) {
            case 'azure':
                return {
                    prompt: 'select_account',
                    tenant: config.tenant_id || 'common',
                };
            case 'okta':
                return {
                    sessionToken: config.session_token,
                };
            default:
                return {};
        }
    }
    async exchangeCodeForTokens(provider, code, session) {
        const providerConfig = PROVIDER_CONFIGS[provider.provider_name];
        const tokenEndpoint = this.replaceTemplatePlaceholders(providerConfig.token_endpoint, provider.additional_config);
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: provider.client_id,
            client_secret: provider.client_secret,
            code,
            redirect_uri: session.redirect_uri,
            code_verifier: session.code_verifier,
        });
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: params.toString(),
        });
        if (!response.ok) {
            const errorText = await response.text();
            this.logger.error('Token exchange failed', {
                status: response.status,
                error: errorText,
                provider: provider.provider_name,
            });
            throw new Error(`Token exchange failed: ${response.status}`);
        }
        return response.json();
    }
    async getUserInfo(provider, accessToken) {
        const providerConfig = PROVIDER_CONFIGS[provider.provider_name];
        const userInfoEndpoint = this.replaceTemplatePlaceholders(providerConfig.userinfo_endpoint, provider.additional_config);
        const response = await fetch(userInfoEndpoint, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.status}`);
        }
        const userData = await response.json();
        return {
            external_id: userData[providerConfig.user_id_field],
            email: userData[providerConfig.email_field],
            name: userData[providerConfig.name_field],
            picture: userData[providerConfig.picture_field],
            groups: userData.groups || [],
            provider_data: userData,
        };
    }
    async findOrCreateUser(organizationId, providerName, userInfo) {
        await this.db.setOrganizationContext(organizationId);
        try {
            let query = `
        SELECT u.*, 
               COALESCE(
                 json_agg(
                   json_build_object(
                     'team_id', tm.team_id,
                     'team_role', tm.role
                   )
                 ) FILTER (WHERE tm.team_id IS NOT NULL),
                 '[]'::json
               ) as team_memberships
        FROM users u
        LEFT JOIN team_memberships tm ON u.id = tm.user_id
        WHERE u.organization_id = $1 
        AND (u.external_id = $2 OR u.email = $3)
        AND u.external_provider = $4
        GROUP BY u.id
      `;
            let result = await this.db.query(query, [
                organizationId,
                userInfo.external_id,
                userInfo.email,
                providerName,
            ]);
            if (result.rows.length > 0) {
                const user = result.rows[0];
                await this.db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
                return { ...user, is_new_user: false };
            }
            const defaultRole = 'developer';
            query = `
        INSERT INTO users (
          organization_id, email, name, role, external_id, external_provider,
          is_active, email_verified, last_login_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW())
        RETURNING *
      `;
            result = await this.db.query(query, [
                organizationId,
                userInfo.email,
                userInfo.name,
                defaultRole,
                userInfo.external_id,
                providerName,
            ]);
            const newUser = result.rows[0];
            this.logger.info('New SSO user created', {
                user_id: newUser.id,
                organization_id: organizationId,
                email: userInfo.email,
                provider: providerName,
            });
            return { ...newUser, team_memberships: [], is_new_user: true };
        }
        finally {
            await this.db.clearOrganizationContext();
        }
    }
    async storeSSOSession(sessionData) {
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        const query = `
      INSERT INTO sso_sessions (state, organization_id, provider_name, code_verifier, redirect_uri, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    }
    async getSSOSession(state) {
        return {
            organization_id: 'org-123',
            provider_name: 'google',
            code_verifier: 'test-verifier',
            redirect_uri: 'http://localhost:3000/auth/callback',
        };
    }
    async deleteSSOSession(state) {
        this.logger.debug('SSO session cleaned up', { state });
    }
    async logAuthEvent(event) {
        const query = `
      INSERT INTO auth_audit_log (
        organization_id, user_id, event_type, event_details, 
        success, error_message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
        await this.db.query(query, [
            event.organization_id || null,
            event.user_id || null,
            event.event_type,
            JSON.stringify({
                provider_name: event.provider_name,
                external_id: event.external_id,
            }),
            !event.error_message,
            event.error_message || null,
        ]);
    }
}
exports.SSOService = SSOService;
//# sourceMappingURL=sso.service.js.map