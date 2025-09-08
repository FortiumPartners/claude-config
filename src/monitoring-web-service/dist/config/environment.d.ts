export declare const config: {
    readonly nodeEnv: "development" | "production" | "test" | "staging";
    readonly port: number;
    readonly log: {
        readonly level: "error" | "warn" | "info" | "debug";
    };
    readonly database: {
        readonly url: string;
    };
    readonly jwt: {
        readonly secret: string;
        readonly refreshSecret: string;
        readonly expiresIn: string;
        readonly refreshExpiresIn: string;
    };
    readonly redis: {
        readonly url: string | undefined;
    };
    readonly cors: {
        readonly origin: any;
    };
    readonly rateLimit: {
        readonly windowMs: number;
        readonly maxRequests: number;
    };
    readonly server: {
        readonly timeout: number;
        readonly keepAliveTimeout: number;
        readonly shutdownTimeout: number;
        readonly trustProxy: boolean;
    };
    readonly compression: {
        readonly level: number;
    };
    readonly bodyParser: {
        readonly limit: string;
    };
    readonly multiTenant: {
        readonly header: string;
    };
    readonly healthCheck: {
        readonly path: string;
    };
    readonly isDevelopment: boolean;
    readonly isProduction: boolean;
    readonly isTest: boolean;
    readonly isStaging: boolean;
};
export type Config = typeof config;
//# sourceMappingURL=environment.d.ts.map