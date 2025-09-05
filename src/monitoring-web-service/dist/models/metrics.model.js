"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsModel = void 0;
class MetricsModel {
    db;
    constructor(db) {
        this.db = db;
    }
    async createCommandExecution(organizationId, data) {
        const query = `
      INSERT INTO command_executions (
        organization_id, user_id, team_id, project_id, command_name, command_args,
        execution_time_ms, status, error_message, context, executed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;
        const values = [
            organizationId,
            data.user_id,
            data.team_id || null,
            data.project_id || null,
            data.command_name,
            JSON.stringify(data.command_args || {}),
            data.execution_time_ms,
            data.status,
            data.error_message || null,
            JSON.stringify(data.context || {})
        ];
        const result = await this.db.query(query, values);
        return this.mapCommandExecution(result.rows[0]);
    }
    async batchCreateCommandExecutions(organizationId, executions) {
        if (executions.length === 0)
            return [];
        const placeholders = executions
            .map((_, index) => {
            const baseIndex = index * 10;
            return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10})`;
        })
            .join(', ');
        const query = `
      INSERT INTO command_executions (
        organization_id, user_id, team_id, project_id, command_name, command_args,
        execution_time_ms, status, error_message, context
      ) VALUES ${placeholders}
      RETURNING *
    `;
        const values = [];
        executions.forEach(exec => {
            values.push(organizationId, exec.user_id, exec.team_id || null, exec.project_id || null, exec.command_name, JSON.stringify(exec.command_args || {}), exec.execution_time_ms, exec.status, exec.error_message || null, JSON.stringify(exec.context || {}));
        });
        const result = await this.db.query(query, values);
        return result.rows.map(this.mapCommandExecution);
    }
    async createAgentInteraction(organizationId, data) {
        const query = `
      INSERT INTO agent_interactions (
        organization_id, user_id, team_id, project_id, command_execution_id,
        agent_name, interaction_type, input_tokens, output_tokens,
        execution_time_ms, status, error_message, metadata, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
    `;
        const values = [
            organizationId,
            data.user_id,
            data.team_id || null,
            data.project_id || null,
            data.command_execution_id || null,
            data.agent_name,
            data.interaction_type,
            data.input_tokens || null,
            data.output_tokens || null,
            data.execution_time_ms,
            data.status,
            data.error_message || null,
            JSON.stringify(data.metadata || {})
        ];
        const result = await this.db.query(query, values);
        return this.mapAgentInteraction(result.rows[0]);
    }
    async createUserSession(organizationId, data) {
        const query = `
      INSERT INTO user_sessions (organization_id, user_id, context)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
        const values = [
            organizationId,
            data.user_id,
            JSON.stringify(data.context || {})
        ];
        const result = await this.db.query(query, values);
        return this.mapUserSession(result.rows[0]);
    }
    async updateUserSession(organizationId, sessionId, data) {
        const setParts = [];
        const values = [organizationId, sessionId];
        let paramIndex = 3;
        if (data.session_end !== undefined) {
            setParts.push(`session_end = $${paramIndex++}`);
            values.push(data.session_end);
        }
        if (data.duration_minutes !== undefined) {
            setParts.push(`duration_minutes = $${paramIndex++}`);
            values.push(data.duration_minutes);
        }
        if (data.commands_executed !== undefined) {
            setParts.push(`commands_executed = $${paramIndex++}`);
            values.push(data.commands_executed);
        }
        if (data.agents_used !== undefined) {
            setParts.push(`agents_used = $${paramIndex++}`);
            values.push(JSON.stringify(data.agents_used));
        }
        if (data.productivity_score !== undefined) {
            setParts.push(`productivity_score = $${paramIndex++}`);
            values.push(data.productivity_score);
        }
        if (data.context !== undefined) {
            setParts.push(`context = $${paramIndex++}`);
            values.push(JSON.stringify(data.context));
        }
        if (setParts.length === 0)
            return null;
        const query = `
      UPDATE user_sessions 
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE organization_id = $1 AND id = $2
      RETURNING *
    `;
        const result = await this.db.query(query, values);
        return result.rows.length > 0 ? this.mapUserSession(result.rows[0]) : null;
    }
    async getActiveUserSession(organizationId, userId) {
        const query = `
      SELECT * FROM user_sessions 
      WHERE organization_id = $1 AND user_id = $2 AND session_end IS NULL
      ORDER BY session_start DESC
      LIMIT 1
    `;
        const result = await this.db.query(query, [organizationId, userId]);
        return result.rows.length > 0 ? this.mapUserSession(result.rows[0]) : null;
    }
    async createProductivityMetric(organizationId, data) {
        const query = `
      INSERT INTO productivity_metrics (
        organization_id, user_id, team_id, project_id, metric_type,
        metric_value, metric_unit, dimensions, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;
        const values = [
            organizationId,
            data.user_id || null,
            data.team_id || null,
            data.project_id || null,
            data.metric_type,
            data.metric_value,
            data.metric_unit || null,
            JSON.stringify(data.dimensions || {})
        ];
        const result = await this.db.query(query, values);
        return this.mapProductivityMetric(result.rows[0]);
    }
    async batchInsertMetrics(batch) {
        let commandCount = 0;
        let agentCount = 0;
        let sessionCount = 0;
        let metricCount = 0;
        await this.db.transaction(async (client) => {
            if (batch.command_executions && batch.command_executions.length > 0) {
                await this.batchCreateCommandExecutions(batch.organization_id, batch.command_executions);
                commandCount = batch.command_executions.length;
            }
            if (batch.agent_interactions && batch.agent_interactions.length > 0) {
                for (const interaction of batch.agent_interactions) {
                    await this.createAgentInteraction(batch.organization_id, interaction);
                    agentCount++;
                }
            }
            if (batch.user_sessions && batch.user_sessions.length > 0) {
                for (const session of batch.user_sessions) {
                    await this.createUserSession(batch.organization_id, session);
                    sessionCount++;
                }
            }
            if (batch.productivity_metrics && batch.productivity_metrics.length > 0) {
                for (const metric of batch.productivity_metrics) {
                    await this.createProductivityMetric(batch.organization_id, metric);
                    metricCount++;
                }
            }
        });
        return {
            command_executions: commandCount,
            agent_interactions: agentCount,
            user_sessions: sessionCount,
            productivity_metrics: metricCount
        };
    }
    async getAggregatedMetrics(params) {
        const windowInterval = this.getWindowInterval(params.aggregation_window || '1h');
        let whereConditions = ['ce.organization_id = $1'];
        let joinConditions = '';
        const values = [params.organization_id, params.start_date, params.end_date];
        let paramIndex = 4;
        if (params.user_id) {
            whereConditions.push(`ce.user_id = $${paramIndex++}`);
            values.push(params.user_id);
        }
        if (params.team_id) {
            whereConditions.push(`ce.team_id = $${paramIndex++}`);
            values.push(params.team_id);
        }
        if (params.project_id) {
            whereConditions.push(`ce.project_id = $${paramIndex++}`);
            values.push(params.project_id);
        }
        const query = `
      WITH aggregated_data AS (
        SELECT 
          time_bucket('${windowInterval}', ce.executed_at) as time_bucket,
          ce.organization_id,
          ${params.user_id ? 'ce.user_id,' : 'NULL as user_id,'}
          ${params.team_id ? 'ce.team_id,' : 'NULL as team_id,'}
          ${params.project_id ? 'ce.project_id,' : 'NULL as project_id,'}
          COUNT(*) as command_count,
          AVG(ce.execution_time_ms) as avg_execution_time,
          COUNT(CASE WHEN ce.status = 'error' THEN 1 END)::float / COUNT(*)::float as error_rate
        FROM command_executions ce
        WHERE ${whereConditions.join(' AND ')}
          AND ce.executed_at >= $2 
          AND ce.executed_at <= $3
        GROUP BY time_bucket, ce.organization_id
        ${params.user_id ? ', ce.user_id' : ''}
        ${params.team_id ? ', ce.team_id' : ''}
        ${params.project_id ? ', ce.project_id' : ''}
        ORDER BY time_bucket DESC
        ${params.limit ? `LIMIT ${params.limit}` : ''}
        ${params.offset ? `OFFSET ${params.offset}` : ''}
      ),
      agent_usage AS (
        SELECT 
          time_bucket('${windowInterval}', ai.occurred_at) as time_bucket,
          ai.organization_id,
          jsonb_object_agg(ai.agent_name, COUNT(*)) as agent_usage_count
        FROM agent_interactions ai
        WHERE ${whereConditions.map(cond => cond.replace('ce.', 'ai.')).join(' AND ')}
          AND ai.occurred_at >= $2 
          AND ai.occurred_at <= $3
        GROUP BY time_bucket, ai.organization_id
        ${params.user_id ? ', ai.user_id' : ''}
        ${params.team_id ? ', ai.team_id' : ''}
        ${params.project_id ? ', ai.project_id' : ''}
      )
      SELECT 
        ad.*,
        COALESCE(au.agent_usage_count, '{}'::jsonb) as agent_usage_count,
        NULL as productivity_score
      FROM aggregated_data ad
      LEFT JOIN agent_usage au ON ad.time_bucket = au.time_bucket 
        AND ad.organization_id = au.organization_id
    `;
        const result = await this.db.query(query, values);
        return result.rows.map(this.mapAggregatedMetrics);
    }
    async getPerformanceMetrics() {
        const queries = [
            'SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE state = \'active\'',
            'SELECT COUNT(*) as total_rows FROM command_executions WHERE executed_at >= NOW() - INTERVAL \'1 hour\'',
            'SELECT pg_size_pretty(pg_database_size(current_database())) as db_size'
        ];
        const results = await Promise.all(queries.map(q => this.db.query(q)));
        return {
            ingestion_rate: parseInt(results[1].rows[0].total_rows) / 3600,
            processing_latency_ms: 0,
            query_response_time_ms: 0,
            memory_usage_mb: 0,
            cpu_usage_percent: 0,
            active_connections: parseInt(results[0].rows[0].active_connections)
        };
    }
    async cleanupOldData(retentionDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const tables = ['command_executions', 'agent_interactions', 'user_sessions', 'productivity_metrics'];
        let totalDeleted = 0;
        for (const table of tables) {
            const timeColumn = table === 'command_executions' ? 'executed_at' :
                table === 'agent_interactions' ? 'occurred_at' :
                    table === 'user_sessions' ? 'session_start' : 'recorded_at';
            const result = await this.db.query(`DELETE FROM ${table} WHERE ${timeColumn} < $1`, [cutoffDate]);
            totalDeleted += result.rowCount || 0;
        }
        return { deleted_rows: totalDeleted };
    }
    getWindowInterval(window) {
        const intervals = {
            '1m': '1 minute',
            '5m': '5 minutes',
            '15m': '15 minutes',
            '1h': '1 hour',
            '1d': '1 day',
            '1w': '1 week'
        };
        return intervals[window] || '1 hour';
    }
    mapCommandExecution(row) {
        return {
            id: row.id,
            organization_id: row.organization_id,
            user_id: row.user_id,
            team_id: row.team_id,
            project_id: row.project_id,
            command_name: row.command_name,
            command_args: row.command_args,
            execution_time_ms: row.execution_time_ms,
            status: row.status,
            error_message: row.error_message,
            context: row.context,
            executed_at: row.executed_at,
            recorded_at: row.executed_at
        };
    }
    mapAgentInteraction(row) {
        return {
            id: row.id,
            organization_id: row.organization_id,
            user_id: row.user_id,
            team_id: row.team_id,
            project_id: row.project_id,
            command_execution_id: row.command_execution_id,
            agent_name: row.agent_name,
            interaction_type: row.interaction_type,
            input_tokens: row.input_tokens,
            output_tokens: row.output_tokens,
            execution_time_ms: row.execution_time_ms,
            status: row.status,
            error_message: row.error_message,
            metadata: row.metadata,
            occurred_at: row.occurred_at,
            recorded_at: row.occurred_at
        };
    }
    mapUserSession(row) {
        return {
            id: row.id,
            organization_id: row.organization_id,
            user_id: row.user_id,
            session_start: row.session_start,
            session_end: row.session_end,
            duration_minutes: row.duration_minutes,
            commands_executed: row.commands_executed,
            agents_used: row.agents_used || [],
            productivity_score: row.productivity_score,
            context: row.context,
            recorded_at: row.session_start
        };
    }
    mapProductivityMetric(row) {
        return {
            id: row.id,
            organization_id: row.organization_id,
            user_id: row.user_id,
            team_id: row.team_id,
            project_id: row.project_id,
            metric_type: row.metric_type,
            metric_value: parseFloat(row.metric_value),
            metric_unit: row.metric_unit,
            dimensions: row.dimensions,
            recorded_at: row.recorded_at
        };
    }
    mapAggregatedMetrics(row) {
        return {
            time_bucket: row.time_bucket,
            organization_id: row.organization_id,
            user_id: row.user_id,
            team_id: row.team_id,
            project_id: row.project_id,
            command_count: parseInt(row.command_count),
            avg_execution_time: parseFloat(row.avg_execution_time),
            error_rate: parseFloat(row.error_rate),
            agent_usage_count: row.agent_usage_count || {},
            productivity_score: row.productivity_score ? parseFloat(row.productivity_score) : undefined
        };
    }
}
exports.MetricsModel = MetricsModel;
//# sourceMappingURL=metrics.model.js.map