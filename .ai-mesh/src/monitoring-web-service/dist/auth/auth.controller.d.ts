import { Request, Response } from 'express';
export declare class AuthController {
    private static getPrisma;
    private static getUserPermissions;
    private static findUserByEmailAndTenant;
    static createOrUpdateSSOUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static login: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static refreshToken: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static logout: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static getProfile: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static updateProfile: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static changePassword: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static validatePassword: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static revokeAllTokens: (req: Request, res: Response, next: import("express").NextFunction) => void;
    static healthCheck: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=auth.controller.d.ts.map