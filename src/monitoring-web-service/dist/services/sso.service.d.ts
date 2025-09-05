import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';
import { JWTService, UserRole } from './jwt.service';
export interface SSOProvider {
    id: string;
    organization_id: string;
    provider_name: string;
    provider_type: 'oauth2' | 'oidc' | 'saml';
    client_id: string;
    client_secret: string;
    discovery_url?: string;
    redirect_uri: string;
    scopes: string[];
    additional_config: Record<string, any>;
    is_active: boolean;
}
export interface SSOAuthRequest {
    provider_name: string;
    organization_id?: string;
    state?: string;
    redirect_uri?: string;
}
export interface SSOAuthResponse {
    authorization_url: string;
    state: string;
    code_verifier?: string;
}
export interface SSOCallbackRequest {
    code: string;
    state: string;
    provider_name: string;
    organization_id?: string;
    code_verifier?: string;
}
export interface SSOUserInfo {
    external_id: string;
    email: string;
    name: string;
    picture?: string;
    groups?: string[];
    organization?: string;
    provider_data: Record<string, any>;
}
export interface SSOAuthResult {
    user: {
        id: string;
        organization_id: string;
        email: string;
        name: string;
        role: UserRole;
        external_id: string;
        external_provider: string;
        is_new_user: boolean;
    };
    tokens: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: 'Bearer';
    };
}
export declare class SSOService {
    private db;
    private logger;
    private jwtService;
    private encryptionKey;
    constructor(db: DatabaseConnection, jwtService: JWTService, logger: winston.Logger);
    private generateEncryptionKey;
    configureSSOProvider(organizationId: string, providerConfig: Omit<SSOProvider, 'id' | 'organization_id'>): Promise<SSOProvider>;
    getSSOProvider(organizationId: string, providerName: string): Promise<SSOProvider | null>;
    initiateSSOAuth(request: SSOAuthRequest): Promise<SSOAuthResponse>;
    handleSSOCallback(request: SSOCallbackRequest): Promise<SSOAuthResult>;
    syncUserGroupsFromSSO(userId: string, providerName: string): Promise<void>;
    listSSOProviders(organizationId: string): Promise<Array<Omit<SSOProvider, 'client_secret' | 'client_secret_encrypted'>>>;
    disableSSOProvider(organizationId: string, providerName: string): Promise<void>;
    private encryptSecret;
    private decryptSecret;
    private replaceTemplatePlaceholders;
    private getProviderSpecificAuthParams;
    private exchangeCodeForTokens;
    private getUserInfo;
    private findOrCreateUser;
    private storeSSOSession;
    private getSSOSession;
    private deleteSSOSession;
    private logAuthEvent;
}
//# sourceMappingURL=sso.service.d.ts.map