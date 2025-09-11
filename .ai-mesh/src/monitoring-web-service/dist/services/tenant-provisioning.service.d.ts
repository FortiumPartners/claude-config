export interface CreateTenantRequest {
    name: string;
    domain: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
    subscriptionPlan?: string;
    billingEmail?: string;
    dataRegion?: string;
    complianceSettings?: Record<string, any>;
}
export interface TenantCreationResult {
    tenant: {
        id: string;
        name: string;
        domain: string;
        schemaName: string;
        subscriptionPlan: string;
        isActive: boolean;
        createdAt: Date;
    };
    adminUser: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        isActive: boolean;
    };
    accessCredentials?: {
        temporaryPassword?: string;
        invitationToken?: string;
    };
}
export declare class TenantProvisioningService {
    private prisma;
    createTenant(request: CreateTenantRequest): Promise<TenantCreationResult>;
    deactivateTenant(tenantId: string): Promise<void>;
    private generateSchemaName;
    private validateSchemaName;
    private createTenantSchema;
    private setupRowLevelSecurity;
    private createDefaultDashboard;
    private generateInvitationToken;
    private cleanupFailedProvisioning;
    getTenantStatus(tenantId: string): Promise<{
        tenant: any;
        userCount: number;
        schemaExists: boolean;
        isHealthy: boolean;
    }>;
    private checkSchemaExists;
}
//# sourceMappingURL=tenant-provisioning.service.d.ts.map