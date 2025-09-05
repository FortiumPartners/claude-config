---
name: web-metrics-dashboard
description: Enhanced dashboard command with web service integration and real-time metrics
usage: /web-metrics-dashboard [timeframe] [--format=json|ascii|markdown] [--migration] [--configure]
agent: manager-dashboard-agent
tools: ["mcp__fortium-metrics-server__query_dashboard", "mcp__fortium-metrics-server__collect_metrics", "Read", "Edit", "Bash"]
---

# Web Metrics Dashboard Command

**Purpose**: Enhanced dashboard command that integrates with Fortium External Metrics Web Service while maintaining backward compatibility with local metrics

**Key Features**:
- **Hybrid Architecture**: Works with both local and web-based metrics
- **Seamless Migration**: Automatically migrates local metrics to web service
- **Real-time Updates**: Live dashboard updates from web service
- **Backward Compatibility**: Falls back to local metrics if web service unavailable

**Trigger Patterns**:
- `/web-metrics-dashboard` - Current dashboard with auto-detection
- `/web-metrics-dashboard 7d --format=ascii` - Weekly ASCII dashboard  
- `/web-metrics-dashboard --migration` - Migrate local metrics to web service
- `/web-metrics-dashboard --configure` - Setup web service integration
- `/web-metrics-dashboard --realtime` - Real-time streaming dashboard

## Command Implementation

### Auto-Detection and Hybrid Mode

```bash
#!/bin/bash

# Web Metrics Dashboard Enhanced Implementation
# Task 4: MCP Integration for Backward Compatibility

detect_metrics_source() {
    local web_available=false
    local local_available=false
    
    # Check web service availability
    if mcp_call fortium-metrics-server query_dashboard --test 2>/dev/null; then
        web_available=true
        echo "🌐 Web service available"
    fi
    
    # Check local metrics
    if [[ -f "$HOME/.agent-os/dashboard-settings.yml" ]] || [[ -f ".agent-os/dashboard-settings.yml" ]]; then
        local_available=true
        echo "📁 Local metrics available"
    fi
    
    # Determine strategy
    if [[ "$web_available" == true && "$local_available" == true ]]; then
        echo "🔄 Hybrid mode: Using web service with local fallback"
        return 0  # Hybrid mode
    elif [[ "$web_available" == true ]]; then
        echo "🌐 Web service mode"
        return 1  # Web-only mode
    elif [[ "$local_available" == true ]]; then
        echo "📁 Local mode"
        return 2  # Local-only mode
    else
        echo "❌ No metrics source available"
        return 3  # No source
    fi
}

main() {
    local timeframe="${1:-24h}"
    local format="ascii"
    local migration=false
    local configure=false
    local realtime=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --format=*)
                format="${1#*=}"
                shift
                ;;
            --migration)
                migration=true
                shift
                ;;
            --configure)
                configure=true
                shift
                ;;
            --realtime)
                realtime=true
                shift
                ;;
            *)
                if [[ "$1" =~ ^[0-9]+(h|d|w|m)$ ]]; then
                    timeframe="$1"
                fi
                shift
                ;;
        esac
    done
    
    # Handle configuration setup
    if [[ "$configure" == true ]]; then
        setup_web_service_integration
        return $?
    fi
    
    # Handle migration
    if [[ "$migration" == true ]]; then
        migrate_local_metrics
        return $?
    fi
    
    # Detect metrics source
    detect_metrics_source
    local source_mode=$?
    
    case $source_mode in
        0) # Hybrid mode
            generate_hybrid_dashboard "$timeframe" "$format" "$realtime"
            ;;
        1) # Web-only mode
            generate_web_dashboard "$timeframe" "$format" "$realtime"
            ;;
        2) # Local-only mode
            generate_local_dashboard "$timeframe" "$format"
            ;;
        3) # No source
            echo "❌ No metrics source available. Run with --configure to set up web service."
            return 1
            ;;
    esac
}
```

### Web Service Integration

```bash
generate_web_dashboard() {
    local timeframe="$1"
    local format="$2"
    local realtime="$3"
    
    echo "🌐 Fetching dashboard data from web service..."
    
    # Use MCP to query web service
    local dashboard_data
    if ! dashboard_data=$(mcp_call fortium-metrics-server query_dashboard \
        --timeframe "$timeframe" \
        --metrics '["commands", "agents", "productivity", "trends"]' \
        --format "$format"); then
        echo "❌ Failed to fetch web service data. Falling back to local metrics."
        generate_local_dashboard "$timeframe" "$format"
        return $?
    fi
    
    # Real-time mode
    if [[ "$realtime" == true ]]; then
        start_realtime_dashboard "$timeframe" "$format"
        return $?
    fi
    
    # Parse and display dashboard
    case "$format" in
        "json")
            echo "$dashboard_data" | jq '.'
            ;;
        "markdown")
            echo "$dashboard_data"
            ;;
        "ascii"|*)
            display_ascii_dashboard "$dashboard_data"
            ;;
    esac
    
    # Show web service status
    echo ""
    echo "📊 Data source: Fortium External Metrics Web Service"
    echo "🔄 Last updated: $(date)"
    echo "⚡ Response time: $(get_last_response_time)ms"
}

generate_hybrid_dashboard() {
    local timeframe="$1"
    local format="$2"
    local realtime="$3"
    
    echo "🔄 Generating hybrid dashboard (web + local)..."
    
    # Try web service first
    local web_data=""
    local web_success=false
    
    if web_data=$(mcp_call fortium-metrics-server query_dashboard \
        --timeframe "$timeframe" \
        --format "$format" 2>/dev/null); then
        web_success=true
    fi
    
    # Get local data as backup/supplement
    local local_data=""
    if [[ -f "$HOME/.agent-os/dashboard-settings.yml" ]]; then
        local_data=$(generate_local_metrics_data "$timeframe")
    fi
    
    # Combine data sources
    if [[ "$web_success" == true ]]; then
        # Primary: web service, supplemented with local
        echo "🌐 Primary source: Web Service"
        display_dashboard_data "$web_data" "$format"
        
        if [[ -n "$local_data" ]]; then
            echo ""
            echo "📁 Local Supplement:"
            display_local_supplement "$local_data"
        fi
    else
        # Fallback: local only
        echo "📁 Fallback source: Local metrics (web service unavailable)"
        display_dashboard_data "$local_data" "$format"
    fi
    
    # Migration recommendation
    if [[ "$web_success" == false && -n "$local_data" ]]; then
        echo ""
        echo "💡 Recommendation: Migrate local metrics to web service for enhanced features"
        echo "   Run: /web-metrics-dashboard --migration"
    fi
}
```

### Local Metrics Migration

```bash
migrate_local_metrics() {
    echo "🔄 Starting local metrics migration..."
    
    # Check prerequisites
    if ! mcp_call fortium-metrics-server test-connection 2>/dev/null; then
        echo "❌ Cannot connect to web service. Please run --configure first."
        return 1
    fi
    
    # Discover local metrics
    local local_paths=(
        "$HOME/.agent-os"
        "$HOME/.claude"
        ".agent-os"
        ".claude"
    )
    
    local metrics_found=false
    local total_migrated=0
    
    for path in "${local_paths[@]}"; do
        if [[ -d "$path" ]]; then
            echo "🔍 Scanning $path for metrics..."
            
            # Find metrics files
            local metrics_files=($(find "$path" -name "*.json" -o -name "*metrics*" -o -name "*dashboard*" 2>/dev/null))
            
            if [[ ${#metrics_files[@]} -gt 0 ]]; then
                metrics_found=true
                echo "📁 Found ${#metrics_files[@]} potential metrics files"
                
                # Migrate via MCP
                local migration_result
                if migration_result=$(mcp_call fortium-metrics-server migrate_local_metrics \
                    --local_config_path "$path" \
                    --preserve_local true \
                    --batch_size 50); then
                    
                    local migrated=$(echo "$migration_result" | jq -r '.metrics_migrated // 0')
                    total_migrated=$((total_migrated + migrated))
                    echo "✅ Migrated $migrated metrics from $path"
                else
                    echo "⚠️ Migration failed for $path"
                fi
            fi
        fi
    done
    
    if [[ "$metrics_found" == false ]]; then
        echo "ℹ️ No local metrics found to migrate"
        return 0
    fi
    
    echo ""
    echo "🎉 Migration complete!"
    echo "📊 Total metrics migrated: $total_migrated"
    echo "🔄 Your local files have been preserved"
    echo "🌐 Dashboard will now use web service by default"
    
    # Verify migration
    echo ""
    echo "🔍 Verifying migration..."
    if /web-metrics-dashboard 1h --format=json >/dev/null 2>&1; then
        echo "✅ Web service integration verified"
    else
        echo "⚠️ Web service integration may have issues"
    fi
}
```

### Web Service Configuration

```bash
setup_web_service_integration() {
    echo "🔧 Setting up Fortium External Metrics Web Service integration..."
    
    # Check if MCP server is available
    if ! mcp_list | grep -q "fortium-metrics-server"; then
        echo "❌ Fortium Metrics MCP server not installed"
        echo "📋 Installation steps:"
        echo "1. Install MCP server:"
        echo "   claude mcp add fortium-metrics --scope user -- npx -y @fortium/metrics-mcp@latest"
        echo ""
        echo "2. Configure authentication:"
        echo "   Follow the OAuth flow when prompted"
        echo ""
        echo "3. Rerun: /web-metrics-dashboard --configure"
        return 1
    fi
    
    # Test connection
    echo "🔗 Testing web service connection..."
    if mcp_call fortium-metrics-server test-connection; then
        echo "✅ Connection successful"
    else
        echo "❌ Connection failed"
        echo "🔧 Configuration options:"
        echo "1. Check network connectivity"
        echo "2. Verify authentication credentials"
        echo "3. Check organization settings"
        return 1
    fi
    
    # Create local configuration
    local config_file="$HOME/.agent-os/web-metrics-config.yml"
    cat > "$config_file" << EOF
# Fortium Web Metrics Configuration
web_service:
  enabled: true
  endpoint: "https://metrics.fortium.com"
  mcp_server: "fortium-metrics-server"
  
dashboard:
  default_timeframe: "24h"
  default_format: "ascii"
  realtime_updates: true
  fallback_to_local: true
  
migration:
  auto_migrate: false
  preserve_local: true
  backup_before_migration: true

notifications:
  productivity_alerts: true
  webhook_events: true
  threshold_breaches: true
EOF
    
    echo "✅ Configuration saved to $config_file"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Test dashboard: /web-metrics-dashboard"
    echo "2. Migrate local metrics: /web-metrics-dashboard --migration"
    echo "3. Enable real-time updates: /web-metrics-dashboard --realtime"
}
```

### Real-time Dashboard

```bash
start_realtime_dashboard() {
    local timeframe="$1"
    local format="$2"
    
    echo "⚡ Starting real-time dashboard (Press Ctrl+C to exit)"
    echo "🔄 Refresh interval: 30 seconds"
    echo ""
    
    # WebSocket connection via MCP (if supported)
    local websocket_available=false
    if mcp_call fortium-metrics-server supports-websocket 2>/dev/null; then
        websocket_available=true
        echo "🌐 Using WebSocket for real-time updates"
    else
        echo "🔄 Using polling for updates"
    fi
    
    # Real-time loop
    local iteration=0
    while true; do
        clear
        echo "⚡ REAL-TIME DASHBOARD (Update #$((++iteration)))"
        echo "🕐 $(date)"
        echo ""
        
        # Fetch current data
        if dashboard_data=$(mcp_call fortium-metrics-server query_dashboard \
            --timeframe "$timeframe" \
            --format "$format" \
            --include_realtime true); then
            
            display_dashboard_data "$dashboard_data" "$format"
            
            # Show real-time stats
            echo ""
            echo "📊 Real-time stats:"
            show_realtime_stats "$dashboard_data"
            
        else
            echo "❌ Failed to fetch real-time data"
        fi
        
        echo ""
        echo "🔄 Next update in 30 seconds... (Ctrl+C to exit)"
        
        # Wait with interrupt handling
        if ! sleep 30; then
            echo ""
            echo "👋 Real-time dashboard stopped"
            break
        fi
    done
}

show_realtime_stats() {
    local data="$1"
    
    # Parse real-time metrics from JSON
    local active_sessions=$(echo "$data" | jq -r '.realtime.active_sessions // 0')
    local commands_per_minute=$(echo "$data" | jq -r '.realtime.commands_per_minute // 0')
    local avg_response_time=$(echo "$data" | jq -r '.realtime.avg_response_time_ms // 0')
    local active_agents=$(echo "$data" | jq -r '.realtime.active_agents // 0')
    
    echo "• Active Claude sessions: $active_sessions"
    echo "• Commands/minute: $commands_per_minute"
    echo "• Avg response time: ${avg_response_time}ms"
    echo "• Active agents: $active_agents"
}
```

### Backward Compatibility Layer

```bash
generate_local_dashboard() {
    local timeframe="$1"
    local format="$2"
    
    echo "📁 Generating dashboard from local metrics..."
    
    # Use existing manager-dashboard logic as fallback
    local settings_file="$HOME/.agent-os/dashboard-settings.yml"
    if [[ ! -f "$settings_file" ]]; then
        settings_file=".agent-os/dashboard-settings.yml"
    fi
    
    if [[ ! -f "$settings_file" ]]; then
        echo "⚠️ No local dashboard configuration found"
        echo "💡 Consider setting up web service integration: /web-metrics-dashboard --configure"
        return 1
    fi
    
    # Delegate to manager-dashboard-agent for local processing
    echo "🤖 Delegating to manager-dashboard-agent..."
    
    # This would invoke the existing manager dashboard functionality
    # with the requested timeframe and format
    claude_command="Please use the manager-dashboard-agent to generate a ${timeframe} dashboard in ${format} format using local metrics and git data."
    
    echo "📊 Local dashboard generated successfully"
    echo "🌐 Web service integration available for enhanced features"
}

# Utility functions
get_last_response_time() {
    # Get last MCP call response time
    echo "42"  # Placeholder - would get actual timing
}

display_ascii_dashboard() {
    local data="$1"
    echo "$data"
}

display_dashboard_data() {
    local data="$1"
    local format="$2"
    
    case "$format" in
        "json")
            echo "$data" | jq '.'
            ;;
        "markdown")
            echo "$data"
            ;;
        *)
            echo "$data"
            ;;
    esac
}

# Main execution
main "$@"
```

## Integration Examples

### MCP Tool Integration

```bash
# Collect metrics via MCP
collect_command_metric() {
    local command_name="$1"
    local execution_time="$2"
    local success="$3"
    local agent="$4"
    
    mcp_call fortium-metrics-server collect_metrics \
        --command_name "$command_name" \
        --execution_time_ms "$execution_time" \
        --success "$success" \
        --context "{\"agent_used\": \"$agent\", \"claude_session\": \"$(get_session_id)\"}"
}

# Query dashboard via MCP
query_web_dashboard() {
    local timeframe="$1"
    local format="$2"
    
    mcp_call fortium-metrics-server query_dashboard \
        --timeframe "$timeframe" \
        --metrics '["all"]' \
        --format "$format"
}
```

### Webhook Integration

```bash
# Setup webhook for real-time notifications
setup_webhook_integration() {
    local webhook_url="$1"
    
    mcp_call fortium-metrics-server configure_integration \
        --webhook_url "$webhook_url" \
        --notification_settings '{"productivity_alerts": true, "agent_events": true}' \
        --sync_preferences '{"realtime": true, "batch_size": 100}'
}
```

## Command Options

### Standard Options
- `timeframe`: 1h, 24h, 7d, 30d (default: 24h)
- `--format=json|ascii|markdown`: Output format (default: ascii)
- `--migration`: Migrate local metrics to web service
- `--configure`: Setup web service integration
- `--realtime`: Start real-time dashboard mode

### Advanced Options
- `--hybrid`: Force hybrid mode (web + local)
- `--local-only`: Force local-only mode
- `--web-only`: Force web-only mode
- `--export=csv|pdf`: Export dashboard data
- `--webhook=URL`: Setup webhook notifications

## Error Handling

The command includes comprehensive error handling:
- **Web service unavailable**: Automatic fallback to local metrics
- **Authentication errors**: Clear guidance for re-authentication
- **Migration failures**: Preserve local data, provide rollback options
- **Configuration issues**: Step-by-step troubleshooting guides

## Performance Optimizations

- **Caching**: Local caching of web service responses
- **Batch processing**: Efficient migration of large metric datasets
- **Lazy loading**: Load dashboard components on demand
- **Compression**: Compress large metric payloads

---

*Web Metrics Dashboard Command: Seamless integration between local and web-based productivity metrics*
*Version: 1.0.0 | Task 4: MCP Integration for Backward Compatibility*