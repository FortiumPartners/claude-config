import { Pool, PoolClient, PoolConfig } from 'pg';
import { ExtendedPrismaClient } from './prisma-client';
import * as winston from 'winston';
export interface DatabaseConnection {
    query: (text: string, params?: any[]) => Promise<any>;
    getClient: () => Promise<PoolClient>;
    pool?: Pool;
    prisma?: ExtendedPrismaClient;
    setOrganizationContext: (organizationId: string) => Promise<void>;
    clearOrganizationContext: () => Promise<void>;
}
export declare class PostgreSQLConnection implements DatabaseConnection {
    private _pool;
    private _prisma;
    private logger;
    private currentOrgContext;
    constructor(config: PoolConfig, logger: winston.Logger);
    get pool(): Pool;
    get prisma(): ExtendedPrismaClient;
    query(text: string, params?: any[]): Promise<any>;
    getClient(): Promise<PoolClient>;
    setOrganizationContext(organizationId: string): Promise<void>;
    clearOrganizationContext(): Promise<void>;
    end(): Promise<void>;
    testConnection(): Promise<boolean>;
}
export declare function createDbConnection(logger?: winston.Logger): Promise<DatabaseConnection>;
//# sourceMappingURL=connection.d.ts.map