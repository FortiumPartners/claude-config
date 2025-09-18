/**
 * Tenant Provisioning Routes
 * Fortium External Metrics Web Service - Task 2.5: Tenant Provisioning System
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../auth/auth.middleware';
import { responseMiddleware } from '../utils/response';
import { asyncHandler } from '../middleware/error.middleware';
import { TenantProvisioningService, CreateTenantRequest } from '../services/tenant-provisioning.service';
import { logger } from '../config/logger';
import { authRateLimit } from '../middleware/security.middleware';

const router = Router();
const tenantService = new TenantProvisioningService();

// Apply response middleware to all tenant routes
router.use(responseMiddleware);

/**
 * @route   POST /admin/tenants
 * @desc    Create new tenant with admin user
 * @access  Super Admin only
 * @rateLimit Standard rate limit
 */
router.post('/',
  authRateLimit,
  authenticateToken,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const tenantRequest: CreateTenantRequest = req.body;

    logger.info('Tenant creation request received', {
      requestedBy: req.user?.userId,
      tenantName: tenantRequest.name,
      domain: tenantRequest.domain,
      adminEmail: tenantRequest.adminEmail,
    });

    const result = await tenantService.createTenant(tenantRequest);

    logger.info('Tenant created successfully', {
      tenantId: result.tenant.id,
      domain: result.tenant.domain,
      createdBy: req.user?.userId,
    });

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: {
        tenant: result.tenant,
        adminUser: {
          id: result.adminUser.id,
          email: result.adminUser.email,
          firstName: result.adminUser.firstName,
          lastName: result.adminUser.lastName,
          role: result.adminUser.role,
          isActive: result.adminUser.isActive,
        },
        next_steps: [
          'Admin user invitation will be sent via email',
          'Initial dashboard and metrics collection are ready',
          'Configure SSO providers if needed',
        ],
        // Note: In production, sensitive credentials would be sent via secure channels
        invitation_url: result.accessCredentials?.invitationToken 
          ? `${process.env.FRONTEND_URL}/accept-invitation?token=${result.accessCredentials.invitationToken}`
          : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   GET /admin/tenants
 * @desc    List all tenants with filtering and pagination
 * @access  Super Admin only
 */
router.get('/',
  authenticateToken,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const isActive = req.query.is_active as string;

    // Build query conditions
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
        { adminEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [tenants, totalCount] = await Promise.all([
      tenantService['prisma'].tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          name: true,
          domain: true,
          schemaName: true,
          subscriptionPlan: true,
          adminEmail: true,
          billingEmail: true,
          dataRegion: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tenantService['prisma'].tenant.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        tenants,
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   GET /admin/tenants/:tenantId
 * @desc    Get detailed tenant information with health status
 * @access  Super Admin only
 */
router.get('/:tenantId',
  authenticateToken,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.params;

    const status = await tenantService.getTenantStatus(tenantId);

    res.json({
      success: true,
      data: {
        tenant: status.tenant,
        statistics: {
          user_count: status.userCount,
          schema_exists: status.schemaExists,
          is_healthy: status.isHealthy,
        },
        health_checks: {
          tenant_active: status.tenant.isActive,
          schema_exists: status.schemaExists,
          has_users: status.userCount > 0,
          overall_status: status.isHealthy ? 'healthy' : 'unhealthy',
        },
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   PUT /admin/tenants/:tenantId
 * @desc    Update tenant configuration
 * @access  Super Admin only
 */
router.put('/:tenantId',
  authenticateToken,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.params;
    const updates = req.body;

    // Only allow specific fields to be updated
    const allowedUpdates = [
      'name',
      'subscriptionPlan',
      'adminEmail',
      'billingEmail',
      'complianceSettings',
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided',
        allowed_fields: allowedUpdates,
        timestamp: new Date().toISOString(),
      });
    }

    const updatedTenant = await tenantService['prisma'].tenant.update({
      where: { id: tenantId },
      data: {
        ...filteredUpdates,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        domain: true,
        subscriptionPlan: true,
        adminEmail: true,
        billingEmail: true,
        complianceSettings: true,
        isActive: true,
        updatedAt: true,
      },
    });

    logger.info('Tenant updated', {
      tenantId,
      updatedBy: req.user?.userId,
      updates: Object.keys(filteredUpdates),
    });

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: {
        tenant: updatedTenant,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   DELETE /admin/tenants/:tenantId
 * @desc    Deactivate tenant (soft delete)
 * @access  Super Admin only
 */
router.delete('/:tenantId',
  authenticateToken,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.params;

    await tenantService.deactivateTenant(tenantId);

    logger.info('Tenant deactivated', {
      tenantId,
      deactivatedBy: req.user?.userId,
    });

    res.json({
      success: true,
      message: 'Tenant deactivated successfully',
      data: {
        tenant_id: tenantId,
        status: 'deactivated',
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   POST /admin/tenants/:tenantId/reactivate
 * @desc    Reactivate deactivated tenant
 * @access  Super Admin only
 */
router.post('/:tenantId/reactivate',
  authenticateToken,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.params;

    const tenant = await tenantService['prisma'].tenant.update({
      where: { id: tenantId },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });

    logger.info('Tenant reactivated', {
      tenantId,
      reactivatedBy: req.user?.userId,
    });

    res.json({
      success: true,
      message: 'Tenant reactivated successfully',
      data: {
        tenant_id: tenantId,
        status: 'active',
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * @route   GET /admin/tenants/:tenantId/health
 * @desc    Comprehensive tenant health check
 * @access  Super Admin only
 */
router.get('/:tenantId/health',
  authenticateToken,
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.params;

    const status = await tenantService.getTenantStatus(tenantId);

    // Additional health checks
    const healthChecks = {
      tenant_exists: !!status.tenant,
      tenant_active: status.tenant?.isActive || false,
      schema_exists: status.schemaExists,
      has_admin_user: status.userCount > 0,
      database_accessible: true, // Already verified by getting status
    };

    const overallHealth = Object.values(healthChecks).every(check => check === true);

    res.json({
      success: true,
      data: {
        tenant_id: tenantId,
        overall_health: overallHealth ? 'healthy' : 'unhealthy',
        health_checks: healthChecks,
        statistics: {
          user_count: status.userCount,
          schema_name: status.tenant?.schemaName,
          created_at: status.tenant?.createdAt,
          subscription_plan: status.tenant?.subscriptionPlan,
        },
        recommendations: overallHealth 
          ? ['Tenant is healthy and fully operational']
          : [
              !healthChecks.tenant_exists && 'Tenant record is missing',
              !healthChecks.tenant_active && 'Tenant is deactivated - consider reactivation',
              !healthChecks.schema_exists && 'Database schema is missing - requires manual recovery',
              !healthChecks.has_admin_user && 'No admin users found - create admin user',
            ].filter(Boolean),
      },
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;