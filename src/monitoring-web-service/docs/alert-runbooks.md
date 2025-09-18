# Alert Response Runbooks
# Task 5.2: Alert Rules Configuration (Sprint 5)
# Comprehensive runbooks for alert response and incident management

## 🚨 Critical (P1) Alerts - Immediate Response Required

### ServiceDown
**Alert Condition**: `up{job="monitoring-web-service"} == 0` for 1 minute  
**Priority**: P1 (Critical)  
**Response Time**: Immediate (0-5 minutes)  

#### Immediate Actions
1. **Check Service Status**
   ```bash
   # Check if service is running
   sudo systemctl status monitoring-web-service
   
   # Check recent logs
   sudo journalctl -u monitoring-web-service --since "5 minutes ago"
   
   # Check application logs
   tail -f /var/log/monitoring-web-service/app.log
   ```

2. **Quick Restart (if safe)**
   ```bash
   # Restart service
   sudo systemctl restart monitoring-web-service
   
   # Wait 30 seconds and check status
   sleep 30 && sudo systemctl status monitoring-web-service
   ```

3. **Verify Recovery**
   ```bash
   # Test health endpoint
   curl http://localhost:3000/api/health
   
   # Check metrics endpoint
   curl http://localhost:3000/api/metrics
   ```

#### Root Cause Investigation
- **Resource Issues**: Check CPU, memory, disk space
- **Database Connection**: Verify PostgreSQL connectivity
- **Network Issues**: Check firewall, DNS resolution
- **Configuration**: Validate environment variables and config files
- **Dependencies**: Ensure Redis, external APIs are accessible

#### Escalation
- If service doesn't recover within 10 minutes, escalate to senior engineer
- If issue is infrastructure-related, escalate to platform team
- If data integrity is at risk, escalate to data team immediately

---

### HighErrorRate
**Alert Condition**: Error rate > 5% for 2 minutes  
**Priority**: P1 (Critical)  
**Response Time**: Immediate (0-5 minutes)  

#### Immediate Actions
1. **Identify Error Patterns**
   ```bash
   # Check recent error logs
   tail -1000 /var/log/monitoring-web-service/error.log | grep "$(date '+%Y-%m-%d %H:%M')"
   
   # Check specific error types
   grep "ERROR" /var/log/monitoring-web-service/app.log | tail -20
   
   # Check database errors
   sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
   ```

2. **Check System Resources**
   ```bash
   # CPU and memory usage
   top -bn1 | grep -E "(Cpu|Mem)"
   
   # Disk space
   df -h
   
   # Network connections
   ss -tuln | grep :3000
   ```

3. **Quick Mitigation**
   ```bash
   # Enable rate limiting (if not already enabled)
   curl -X POST http://localhost:3000/api/admin/rate-limit/enable
   
   # Scale horizontally (if load balancer configured)
   kubectl scale deployment monitoring-web-service --replicas=3
   ```

#### Investigation Steps
1. **Error Classification**
   - 5xx errors: Server-side issues (database, internal logic)
   - 4xx errors: Client-side issues (validation, authentication)
   - Timeout errors: Performance or resource constraints

2. **Common Root Causes**
   - Database connection pool exhaustion
   - Memory leaks causing OOM
   - External API failures
   - Invalid input data causing crashes
   - Configuration errors

3. **Resolution Strategies**
   - Restart service if memory/resource issue
   - Scale out if load-related
   - Fix configuration if config-related
   - Roll back recent deployments if regression

---

### DatabaseConnectionFailure
**Alert Condition**: `postgresql_up{job="postgresql"} == 0` for 1 minute  
**Priority**: P1 (Critical)  
**Response Time**: Immediate (0-5 minutes)  

#### Immediate Actions
1. **Check Database Status**
   ```bash
   # Check PostgreSQL service
   sudo systemctl status postgresql
   
   # Check database logs
   sudo tail -f /var/log/postgresql/postgresql-*.log
   
   # Check connection limits
   sudo -u postgres psql -c "SELECT count(*) as active_connections FROM pg_stat_activity;"
   ```

2. **Verify Connectivity**
   ```bash
   # Test local connection
   sudo -u postgres psql -c "SELECT version();"
   
   # Test application connection
   psql -h localhost -U app_user -d monitoring_db -c "SELECT 1;"
   ```

3. **Resource Check**
   ```bash
   # Disk space for database
   df -h /var/lib/postgresql/
   
   # Memory usage
   ps aux | grep postgres
   
   # Check for locks
   sudo -u postgres psql -c "SELECT * FROM pg_locks WHERE NOT granted;"
   ```

#### Recovery Actions
1. **Service Restart** (if safe)
   ```bash
   sudo systemctl restart postgresql
   ```

2. **Connection Pool Reset**
   ```bash
   # Reset application connection pools
   curl -X POST http://localhost:3000/api/admin/db/reset-pool
   ```

3. **Emergency Procedures**
   - If corruption suspected: Stop writes, enable read-only mode
   - If disk full: Clear logs, add storage
   - If deadlocks: Restart service with connection limit

---

## ⚠️ High Priority (P2) Alerts - 15 Minute Response

### HighResponseTime
**Alert Condition**: P95 response time > 5s for 5 minutes  
**Priority**: P2 (High)  
**Response Time**: 15 minutes  

#### Investigation Steps
1. **Performance Analysis**
   ```bash
   # Check active requests
   curl http://localhost:3000/api/admin/active-requests
   
   # Database query performance
   sudo -u postgres psql -c "SELECT query, calls, mean_time, rows FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   
   # Memory and CPU utilization
   free -h && uptime
   ```

2. **Identify Bottlenecks**
   - Database slow queries
   - High CPU utilization
   - Memory pressure
   - Network latency
   - External API delays

3. **Optimization Actions**
   ```bash
   # Enable query caching
   curl -X POST http://localhost:3000/api/admin/cache/enable
   
   # Increase connection pool size
   curl -X POST http://localhost:3000/api/admin/db/pool/increase
   
   # Clear application caches if needed
   curl -X DELETE http://localhost:3000/api/admin/cache/clear
   ```

---

### DatabaseSlowQuery
**Alert Condition**: Slow queries > 10 for 5 minutes  
**Priority**: P2 (High)  
**Response Time**: 15 minutes  

#### Investigation Steps
1. **Identify Slow Queries**
   ```sql
   -- Top 10 slowest queries
   SELECT query, calls, total_time, mean_time, rows 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   
   -- Currently running slow queries
   SELECT pid, now() - pg_stat_activity.query_start as duration, query 
   FROM pg_stat_activity 
   WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
   ```

2. **Analysis Actions**
   ```sql
   -- Check for missing indexes
   SELECT schemaname, tablename, attname, n_distinct, correlation 
   FROM pg_stats 
   WHERE schemaname = 'public';
   
   -- Analyze table statistics
   ANALYZE;
   
   -- Check index usage
   SELECT indexrelname, idx_tup_read, idx_tup_fetch 
   FROM pg_stat_user_indexes;
   ```

3. **Optimization Steps**
   - Add missing indexes
   - Update table statistics
   - Optimize query structure
   - Consider query rewriting
   - Partition large tables if needed

---

## 📊 Medium Priority (P3) Alerts - 1 Hour Response

### ModerateErrorRate
**Alert Condition**: Error rate > 2% for 10 minutes  
**Priority**: P3 (Medium)  
**Response Time**: 1 hour  

#### Investigation Approach
1. **Error Pattern Analysis**
   - Identify error types and frequency
   - Check for correlation with deployments
   - Analyze user impact and affected features

2. **Gradual Mitigation**
   - Enable additional logging
   - Implement feature flags for problematic features
   - Prepare rollback plan if needed

3. **Long-term Resolution**
   - Fix underlying bugs
   - Improve error handling
   - Add more robust validation

---

### HighDiskUsage
**Alert Condition**: Disk usage > 80% for 15 minutes  
**Priority**: P3 (Medium)  
**Response Time**: 1 hour  

#### Cleanup Actions
1. **Log Rotation**
   ```bash
   # Force log rotation
   sudo logrotate -f /etc/logrotate.d/monitoring-web-service
   
   # Clear old logs
   find /var/log/monitoring-web-service/ -name "*.log.*" -mtime +7 -delete
   ```

2. **Temporary Files**
   ```bash
   # Clean temp files
   sudo find /tmp -name "*monitoring*" -mtime +1 -delete
   
   # Clean application cache
   rm -rf /var/cache/monitoring-web-service/*
   ```

3. **Database Maintenance**
   ```sql
   -- Vacuum and analyze
   VACUUM ANALYZE;
   
   -- Clean up old data if configured
   DELETE FROM audit_logs WHERE created_at < now() - interval '90 days';
   ```

---

## 📈 Low Priority (P4) Alerts - 4 Hour Response

### ElevatedCPUUsage
**Alert Condition**: CPU usage > 70% for 30 minutes  
**Priority**: P4 (Low)  
**Response Time**: 4 hours  

#### Monitoring Actions
1. **Trend Analysis**
   - Monitor CPU usage trends
   - Identify peak usage periods
   - Correlate with business metrics

2. **Capacity Planning**
   - Evaluate need for vertical scaling
   - Consider horizontal scaling options
   - Plan for future growth

3. **Optimization Opportunities**
   - Profile CPU-intensive operations
   - Optimize algorithms and queries
   - Consider caching strategies

---

## 🔧 General Troubleshooting Procedures

### Health Check Commands
```bash
# Application health
curl http://localhost:3000/api/health

# Detailed status
curl http://localhost:3000/api/status

# Metrics endpoint
curl http://localhost:3000/api/metrics

# Database connectivity
psql -h localhost -U app_user -d monitoring_db -c "SELECT 1;"

# Redis connectivity
redis-cli ping
```

### Log Analysis
```bash
# Application logs
tail -f /var/log/monitoring-web-service/app.log

# Error logs only
grep "ERROR" /var/log/monitoring-web-service/app.log | tail -20

# Filter by time range
grep "2024-01-15 14:" /var/log/monitoring-web-service/app.log

# Search for specific patterns
grep -i "database\|timeout\|error" /var/log/monitoring-web-service/app.log | tail -50
```

### Performance Monitoring
```bash
# Real-time resource usage
htop

# Network connections
netstat -tulpn | grep :3000

# Memory usage by process
ps aux --sort=-%mem | head -20

# Disk I/O
iostat -x 1

# Database connections
sudo -u postgres psql -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

### Emergency Contacts
- **Platform Team**: platform-team@fortium.dev, Slack: #platform-alerts
- **Security Team**: security-team@fortium.dev, Slack: #security-alerts  
- **Database Team**: database-team@fortium.dev, Slack: #database-alerts
- **On-Call Engineer**: oncall-engineer@fortium.dev, Phone: +1-555-ONCALL
- **Executive Escalation**: executive-escalation@fortium.dev

### Service Recovery Checklist
- [ ] Identify root cause
- [ ] Implement immediate fix or workaround
- [ ] Verify service recovery
- [ ] Update stakeholders on status
- [ ] Document incident details
- [ ] Schedule post-mortem meeting
- [ ] Implement preventive measures
- [ ] Update runbooks if needed

### Post-Incident Actions
1. **Incident Documentation**
   - Create incident report with timeline
   - Document root cause and resolution
   - Calculate impact metrics (downtime, affected users)

2. **Post-Mortem Meeting**
   - Schedule within 24-48 hours
   - Include all involved team members
   - Focus on process improvements, not blame

3. **Follow-up Actions**
   - Implement action items from post-mortem
   - Update monitoring and alerting rules
   - Improve documentation and runbooks
   - Consider architectural improvements

---

## 📚 Additional Resources

### Dashboards
- **System Overview**: https://signoz.fortium.dev/dashboard/system-overview
- **Application Metrics**: https://signoz.fortium.dev/dashboard/application-metrics
- **Database Performance**: https://signoz.fortium.dev/dashboard/database-performance
- **Alert Status**: https://alertmanager.fortium.dev

### Documentation
- **System Architecture**: https://docs.fortium.dev/architecture/monitoring-service
- **API Documentation**: https://docs.fortium.dev/api/monitoring-service
- **Deployment Guide**: https://docs.fortium.dev/deployment/monitoring-service
- **Configuration Reference**: https://docs.fortium.dev/config/monitoring-service

### Tools
- **Log Aggregation**: Elasticsearch/Kibana or equivalent
- **Metrics Visualization**: Grafana dashboards
- **Incident Management**: PagerDuty or equivalent
- **Communication**: Slack channels for real-time coordination

Remember: When in doubt, escalate early rather than late. It's better to involve additional help than to let an incident impact users.