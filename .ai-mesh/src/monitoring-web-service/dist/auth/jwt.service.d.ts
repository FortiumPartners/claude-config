export interface JwtPayload {
    userId: string;
    tenantId: string;
    email: string;
    role: string;
    permissions?: string[];
    iat?: number;
    exp?: number;
}
export interface RefreshTokenPayload {
    userId: string;
    tenantId: string;
    tokenId: string;
    iat?: number;
    exp?: number;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshExpiresIn: number;
}
export declare class JwtService {
    static generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string;
    static generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string;
    static generateTokenPair(userId: string, tenantId: string, email: string, role: string, permissions?: string[]): TokenPair;
    static verifyAccessToken(token: string): JwtPayload;
    static verifyRefreshToken(token: string): RefreshTokenPayload;
    static decodeToken(token: string): any;
    static isTokenExpired(token: string): boolean;
    static getTokenExpiration(token: string): Date | null;
    static extractTokenFromHeader(authHeader: string | undefined): string | null;
    private static maskToken;
    private static parseExpirationTime;
}
//# sourceMappingURL=jwt.service.d.ts.map