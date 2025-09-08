import * as joi from 'joi';
import { Request, Response, NextFunction } from 'express';
export declare const commonSchemas: {
    uuid: joi.StringSchema<string>;
    email: joi.StringSchema<string>;
    password: joi.StringSchema<string>;
    tenantId: joi.StringSchema<string>;
    pagination: joi.ObjectSchema<any>;
    dateRange: joi.ObjectSchema<any>;
    timestamp: joi.DateSchema<Date>;
    apiVersion: joi.StringSchema<string>;
};
export declare const authSchemas: {
    login: joi.ObjectSchema<any>;
    refreshToken: joi.ObjectSchema<any>;
    changePassword: joi.ObjectSchema<any>;
    validatePassword: joi.ObjectSchema<any>;
};
export declare const userSchemas: {
    createUser: joi.ObjectSchema<any>;
    updateUser: joi.ObjectSchema<any>;
    queryUsers: joi.ObjectSchema<any>;
};
export declare const metricsSchemas: {
    submitMetrics: joi.ObjectSchema<any>;
    queryMetrics: joi.ObjectSchema<any>;
    aggregateMetrics: joi.ObjectSchema<any>;
};
export declare const dashboardSchemas: {
    createDashboard: joi.ObjectSchema<any>;
    updateDashboard: joi.ObjectSchema<any>;
    queryDashboards: joi.ObjectSchema<any>;
};
export declare const validate: (schema: joi.ObjectSchema, location?: "body" | "query" | "params" | "headers") => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateMultiple: (validations: Array<{
    schema: joi.ObjectSchema;
    location: "body" | "query" | "params" | "headers";
}>) => (req: Request, res: Response, next: NextFunction) => void;
export declare const customValidations: {
    uuidParam: (paramName: string) => (req: Request, res: Response, next: NextFunction) => void;
    paginationQuery: () => (req: Request, res: Response, next: NextFunction) => void;
    dateRangeQuery: () => (req: Request, res: Response, next: NextFunction) => void;
    tenantHeader: () => (req: Request, res: Response, next: NextFunction) => void;
};
//# sourceMappingURL=validation.d.ts.map