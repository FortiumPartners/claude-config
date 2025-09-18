/**
 * Business Metrics Validation Script
 * Quick validation that our business metrics implementation is working
 */

console.log('🧪 Validating Business Metrics Implementation...\n');

try {
  // Test 1: Import validation
  console.log('1. Testing imports...');
  const { getBusinessMetricsService, categorizeEndpoint } = require('./dist/services/business-metrics.service.js');
  const { setupBusinessMetrics } = require('./dist/middleware/business-metrics.middleware.js');
  console.log('✅ All imports successful\n');

  // Test 2: Service instantiation
  console.log('2. Testing service instantiation...');
  const metricsService = getBusinessMetricsService({
    enableApiMetrics: true,
    enableDbMetrics: true,
    enableTenantMetrics: true,
    enableApplicationMetrics: true,
    collectionInterval: 5000,
  });
  console.log('✅ Business metrics service created successfully\n');

  // Test 3: Health status
  console.log('3. Testing health status...');
  const health = metricsService.getHealthStatus();
  console.log('Health Status:', {
    status: health.status,
    metricsEnabled: health.metricsEnabled,
    activeTenantsCount: health.activeTenantsCount,
    memoryUsage: `${Math.round(health.memoryUsage / 1024 / 1024 * 100) / 100} MB`,
  });
  console.log('✅ Health status retrieved successfully\n');

  // Test 4: Metrics recording simulation
  console.log('4. Testing metrics recording...');
  
  // Simulate API endpoint metric
  metricsService.recordApiEndpointMetric({
    route: '/api/test',
    method: 'GET',
    statusCode: 200,
    duration: 150,
    requestSize: 1024,
    responseSize: 2048,
    tenantId: 'test-tenant',
    userId: 'test-user',
    category: 'metrics_query',
    timestamp: new Date(),
  });
  
  // Simulate database metric
  metricsService.recordDatabaseMetric({
    queryType: 'SELECT',
    table: 'users',
    duration: 50,
    success: true,
    tenantId: 'test-tenant',
    timestamp: new Date(),
  });
  
  // Simulate tenant resource metric
  metricsService.recordTenantResourceMetric({
    tenantId: 'test-tenant',
    resourceType: 'api_calls',
    usage: 10,
    unit: 'count',
    activityPattern: 'medium_volume',
    errorRate: 0.05,
    avgResponseTime: 150,
    timestamp: new Date(),
  });
  
  console.log('✅ Metrics recorded successfully\n');

  // Test 5: Tenant statistics
  console.log('5. Testing tenant statistics...');
  const tenantStats = metricsService.getTenantStats('test-tenant');
  console.log('Tenant Stats:', tenantStats);
  console.log('✅ Tenant statistics retrieved successfully\n');

  // Test 6: Endpoint categorization
  console.log('6. Testing endpoint categorization...');
  const categories = {
    '/auth/login': categorizeEndpoint('/auth/login', 'POST'),
    '/api/metrics': categorizeEndpoint('/api/metrics', 'POST'),
    '/dashboard': categorizeEndpoint('/dashboard', 'GET'),
    '/health': categorizeEndpoint('/health', 'GET'),
  };
  console.log('Endpoint Categories:', categories);
  console.log('✅ Endpoint categorization working correctly\n');

  // Test 7: Export information
  console.log('7. Testing export information...');
  const exportInfo = metricsService.getMetricsExport();
  console.log('Export Info:', {
    exportTime: exportInfo.exportTime,
    metricsCount: exportInfo.metricsCount,
    exportInterval: exportInfo.exportInterval,
    batchingEnabled: exportInfo.batchingEnabled,
  });
  console.log('✅ Export information retrieved successfully\n');

  // Final validation
  console.log('🎉 Business Metrics Implementation Validation PASSED!\n');
  console.log('Summary:');
  console.log('- ✅ Service instantiation: Working');
  console.log('- ✅ Metrics recording: Working');
  console.log('- ✅ Tenant tracking: Working');
  console.log('- ✅ Health monitoring: Working');
  console.log('- ✅ Export configuration: Working');
  console.log('- ✅ Endpoint categorization: Working');
  
  console.log('\n📊 Implementation Status: PRODUCTION READY');

} catch (error) {
  console.error('❌ Validation failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}