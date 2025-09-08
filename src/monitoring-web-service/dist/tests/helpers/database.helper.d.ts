import { DatabaseConnection } from '../../database/connection';
export interface TestDatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}
export declare function createTestDatabase(config?: Partial<TestDatabaseConfig>): Promise<DatabaseConnection>;
export declare function cleanupTestDatabase(connection: DatabaseConnection): Promise<void>;
export declare function seedTestData(connection: DatabaseConnection): Promise<void>;
export declare const testDbConfig: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
};
//# sourceMappingURL=database.helper.d.ts.map