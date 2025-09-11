import { PrismaClient } from '../generated/prisma-client';
import { TransformationResult } from './data-transformer';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    integrityChecks: {
        sessionDataIntegrity: boolean;
        toolMetricConsistency: boolean;
        foreignKeyIntegrity: boolean;
        duplicateCheck: boolean;
        constraintValidation: boolean;
        businessRuleValidation: boolean;
    };
    statistics: {
        totalRecordsValidated: number;
        sessionRecordsValidated: number;
        toolMetricRecordsValidated: number;
        validRecords: number;
        invalidRecords: number;
        validationTimeMs: number;
    };
}
export interface ValidationRule {
    name: string;
    description: string;
    severity: 'error' | 'warning';
    validator: (data: any) => ValidationIssue | null;
}
export interface ValidationIssue {
    rule: string;
    severity: 'error' | 'warning';
    message: string;
    recordId?: string;
    field?: string;
    value?: any;
    suggestion?: string;
}
export declare class DataValidator {
    private readonly prisma;
    private readonly tenantSchemaName;
    private readonly sessionRules;
    private readonly toolMetricRules;
    private readonly businessRules;
    constructor(prisma: PrismaClient, tenantSchemaName: string);
    validateTransformationResult(transformationResult: TransformationResult): Promise<ValidationResult>;
    private validateSessions;
    private validateToolMetrics;
    private validateForeignKeys;
    private validateDuplicates;
    private validateDatabaseConstraints;
    private validateBusinessRules;
    private createSessionValidationRules;
    private createToolMetricValidationRules;
    private createBusinessValidationRules;
    private findDuplicates;
}
export declare class PostImportValidator {
    private readonly prisma;
    private readonly tenantSchemaName;
    constructor(prisma: PrismaClient, tenantSchemaName: string);
    validateImportedData(originalData: TransformationResult): Promise<ValidationResult>;
    private validateSampleRecords;
}
//# sourceMappingURL=data-validator.d.ts.map