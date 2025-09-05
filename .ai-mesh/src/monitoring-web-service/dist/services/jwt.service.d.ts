import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';
export interface JWTPayload {
    user_id: string;
    organization_id: string;
    email: string;
    role: UserRole;
    team_memberships?: Array<{
        team_id: string;
        team_role: TeamRole;
    }>;
    permissions?: Permission[];
    iat?: number;
    exp?: number;
    jti?: string;
}
export interface RefreshTokenPayload {
    user_id: string;
    organization_id: string;
    token_family: string;
    jti: string;
}
export interface TokenPair {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: 'Bearer';
}
export type UserRole = 'owner' | 'admin' | 'manager' | 'developer' | 'viewer';
export type TeamRole = 'lead' | 'member';
export interface Permission {
    resource: string;
    action: string;
    condition?: string;
}
export declare const ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
export declare class JWTService {
    private accessTokenSecret;
    private refreshTokenSecret;
    private accessTokenExpiry;
    private refreshTokenExpiry;
    private issuer;
    private db;
    private logger;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    private generateSecret;
    generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): Promise<TokenPair>;
    verifyAccessToken(token: string): Promise<JWTPayload>;
    verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
    refreshAccessToken(refreshToken: string): Promise<TokenPair>;
    revokeAccessToken(jti: string): Promise<void>;
    revokeRefreshToken(jti: string): Promise<void>;
    revokeAllUserTokens(userId: string): Promise<void>;
    hasPermission(userPayload: JWTPayload, resource: string, action: string, context?: any): boolean;
    private calculatePermissions;
    private evaluatePermissionCondition;
    private storeRefreshToken;
    private getRefreshToken;
    private isTokenBlacklisted;
    private parseExpiry;
    cleanupExpiredTokens(): Promise<void>;
}
//# sourceMappingURL=jwt.service.d.ts.map