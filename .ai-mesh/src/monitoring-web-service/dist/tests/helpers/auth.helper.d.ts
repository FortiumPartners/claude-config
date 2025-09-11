import { DatabaseConnection } from '../../database/connection';
import { UserRole, TeamRole } from '../../services/jwt.service';
export interface TestUser {
    id: string;
    organization_id: string;
    email: string;
    password_hash: string;
    role: UserRole;
    profile?: any;
}
export interface TestOrganization {
    id: string;
    name: string;
    slug: string;
    settings?: any;
}
export interface TestTeam {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
}
export declare function createTestOrganization(connection: DatabaseConnection, orgData?: Partial<TestOrganization>): Promise<TestOrganization>;
export declare function createTestUser(connection: DatabaseConnection, userData?: Partial<TestUser>): Promise<TestUser>;
export declare function createTestTeam(connection: DatabaseConnection, teamData?: Partial<TestTeam>): Promise<TestTeam>;
export declare function addUserToTeam(connection: DatabaseConnection, userId: string, teamId: string, role?: TeamRole): Promise<void>;
export declare function createAuthenticatedUser(connection: DatabaseConnection, userData?: Partial<TestUser>): Promise<{
    user: TestUser;
    tokens: any;
}>;
export declare function createManagerWithTeam(connection: DatabaseConnection): Promise<{
    user: TestUser;
    team: TestTeam;
    tokens: any;
}>;
export declare function cleanupTestAuth(connection: DatabaseConnection): Promise<void>;
//# sourceMappingURL=auth.helper.d.ts.map