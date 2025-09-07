#!/bin/bash
# User Data Script for EC2 Instances
# Infrastructure Management Subagent - Cost Optimization and Resource Management

# Variables passed from Terraform
APP_NAME="${app_name}"
ENVIRONMENT="${environment}"
REGION="${region}"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> /var/log/user-data.log
}

log "Starting user data script for $APP_NAME in $ENVIRONMENT"

# Update the system
yum update -y

# Install CloudWatch agent
log "Installing CloudWatch agent"
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Install Docker
log "Installing Docker"
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
log "Installing Docker Compose"
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install additional tools
log "Installing additional tools"
yum install -y htop iotop awscli jq

# Configure CloudWatch agent
log "Configuring CloudWatch agent"
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<EOF
{
    "agent": {
        "metrics_collection_interval": 60,
        "run_as_user": "cwagent"
    },
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/messages",
                        "log_group_name": "/aws/ec2/$APP_NAME-$ENVIRONMENT",
                        "log_stream_name": "{instance_id}/messages"
                    },
                    {
                        "file_path": "/var/log/docker",
                        "log_group_name": "/aws/ec2/$APP_NAME-$ENVIRONMENT",
                        "log_stream_name": "{instance_id}/docker"
                    },
                    {
                        "file_path": "/var/log/user-data.log",
                        "log_group_name": "/aws/ec2/$APP_NAME-$ENVIRONMENT",
                        "log_stream_name": "{instance_id}/user-data"
                    }
                ]
            }
        }
    },
    "metrics": {
        "namespace": "CWAgent",
        "metrics_collected": {
            "cpu": {
                "measurement": [
                    "cpu_usage_idle",
                    "cpu_usage_iowait",
                    "cpu_usage_user",
                    "cpu_usage_system"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ],
                "totalcpu": false
            },
            "disk": {
                "measurement": [
                    "used_percent"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ]
            },
            "diskio": {
                "measurement": [
                    "io_time"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ]
            },
            "mem": {
                "measurement": [
                    "mem_used_percent"
                ],
                "metrics_collection_interval": 60
            },
            "netstat": {
                "measurement": [
                    "tcp_established",
                    "tcp_time_wait"
                ],
                "metrics_collection_interval": 60
            },
            "swap": {
                "measurement": [
                    "swap_used_percent"
                ],
                "metrics_collection_interval": 60
            }
        }
    }
}
EOF

# Start CloudWatch agent
log "Starting CloudWatch agent"
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Configure cost monitoring script
log "Setting up cost monitoring"
cat > /usr/local/bin/cost-monitor.sh <<'EOF'
#!/bin/bash

# Cost monitoring and optimization script
APP_NAME="${APP_NAME}"
ENVIRONMENT="${ENVIRONMENT}"
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

# Function to send custom metrics
send_metric() {
    local metric_name=$1
    local value=$2
    local unit=$3
    local namespace="$APP_NAME/$ENVIRONMENT/CostOptimization"
    
    aws cloudwatch put-metric-data \
        --region "$REGION" \
        --namespace "$namespace" \
        --metric-data MetricName="$metric_name",Value="$value",Unit="$unit",Dimensions=InstanceId="$INSTANCE_ID"
}

# Monitor CPU utilization for right-sizing
CPU_UTIL=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
send_metric "CPUUtilization" "$CPU_UTIL" "Percent"

# Monitor memory usage
MEM_UTIL=$(free | grep Mem | awk '{printf "%.2f", ($3/$2) * 100.0}')
send_metric "MemoryUtilization" "$MEM_UTIL" "Percent"

# Monitor disk usage
DISK_UTIL=$(df / | tail -1 | awk '{print $(NF-1)}' | sed 's/%//')
send_metric "DiskUtilization" "$DISK_UTIL" "Percent"

# Check if instance is underutilized (for spot instance recommendations)
if (( $(echo "$CPU_UTIL < 20" | bc -l) )) && (( $(echo "$MEM_UTIL < 50" | bc -l) )); then
    send_metric "UnderUtilized" "1" "Count"
else
    send_metric "UnderUtilized" "0" "Count"
fi

# Log the metrics
echo "$(date): CPU: $CPU_UTIL%, Memory: $MEM_UTIL%, Disk: $DISK_UTIL%" >> /var/log/cost-metrics.log
EOF

chmod +x /usr/local/bin/cost-monitor.sh

# Set up cron job for cost monitoring
log "Setting up cost monitoring cron job"
echo "*/5 * * * * /usr/local/bin/cost-monitor.sh" > /var/spool/cron/root
crontab /var/spool/cron/root

# Configure log rotation for cost efficiency
log "Configuring log rotation"
cat > /etc/logrotate.d/cost-optimization <<EOF
/var/log/cost-metrics.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}

/var/log/user-data.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

# Install and configure Spot Instance interruption handler
if [ "$ENVIRONMENT" != "production" ]; then
    log "Setting up spot instance interruption handler"
    
    cat > /usr/local/bin/spot-interruption-handler.sh <<'EOF'
#!/bin/bash

# Spot instance interruption handler
while true; do
    if curl -s http://169.254.169.254/latest/meta-data/spot/instance-action | grep -q "terminate"; then
        echo "$(date): Spot interruption notice received, starting graceful shutdown" >> /var/log/spot-interruption.log
        
        # Drain containers gracefully
        docker stop $(docker ps -q) 2>/dev/null || true
        
        # Send notification
        INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
        aws sns publish --region "$REGION" --topic-arn "${sns_topic_arn}" --message "Spot instance $INSTANCE_ID is being terminated"
        
        # Wait a bit before shutdown
        sleep 30
        break
    fi
    sleep 5
done
EOF
    
    chmod +x /usr/local/bin/spot-interruption-handler.sh
    
    # Start spot interruption handler as a service
    cat > /etc/systemd/system/spot-interruption-handler.service <<EOF
[Unit]
Description=Spot Instance Interruption Handler
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/spot-interruption-handler.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable spot-interruption-handler.service
    systemctl start spot-interruption-handler.service
fi

# Set up automatic EBS volume optimization
log "Setting up EBS volume optimization"
cat > /usr/local/bin/ebs-optimizer.sh <<'EOF'
#!/bin/bash

# EBS volume optimization script
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

# Get volume information
VOLUME_ID=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" --query 'Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId' --output text)

# Check if volume is gp2 and can be upgraded to gp3
VOLUME_TYPE=$(aws ec2 describe-volumes --volume-ids "$VOLUME_ID" --region "$REGION" --query 'Volumes[0].VolumeType' --output text)

if [ "$VOLUME_TYPE" = "gp2" ]; then
    echo "$(date): Upgrading volume $VOLUME_ID from gp2 to gp3 for cost savings" >> /var/log/ebs-optimization.log
    aws ec2 modify-volume --volume-id "$VOLUME_ID" --volume-type gp3 --region "$REGION" || echo "Failed to modify volume"
fi
EOF

chmod +x /usr/local/bin/ebs-optimizer.sh

# Run EBS optimizer once during initialization
/usr/local/bin/ebs-optimizer.sh

# Configure timezone for accurate cost reporting
log "Configuring timezone"
timedatectl set-timezone UTC

# Set up system monitoring dashboard
log "Setting up system monitoring"
cat > /usr/local/bin/system-stats.sh <<'EOF'
#!/bin/bash

# System statistics for cost optimization
echo "=== System Stats $(date) ===" >> /var/log/system-stats.log
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')%" >> /var/log/system-stats.log
echo "Memory: $(free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100.0}')%" >> /var/log/system-stats.log
echo "Disk: $(df / | tail -1 | awk '{print $(NF-1)}')" >> /var/log/system-stats.log
echo "Load: $(uptime | awk -F'load average:' '{ print $2 }')" >> /var/log/system-stats.log
echo "Connections: $(netstat -an | grep :80 | wc -l)" >> /var/log/system-stats.log
echo "Docker containers: $(docker ps | wc -l)" >> /var/log/system-stats.log
echo "" >> /var/log/system-stats.log
EOF

chmod +x /usr/local/bin/system-stats.sh

# Add system stats to cron
echo "0 * * * * /usr/local/bin/system-stats.sh" >> /var/spool/cron/root
crontab /var/spool/cron/root

# Configure environment-specific optimizations
if [ "$ENVIRONMENT" = "development" ]; then
    log "Applying development environment optimizations"
    
    # Set up auto-shutdown for weekends (development only)
    cat > /usr/local/bin/weekend-shutdown.sh <<'EOF'
#!/bin/bash
# Shutdown instance on Friday evening, will be restarted by ASG if needed
DAY=$(date +%u)
HOUR=$(date +%H)
if [ "$DAY" = "5" ] && [ "$HOUR" = "20" ]; then
    echo "$(date): Weekend shutdown initiated" >> /var/log/weekend-shutdown.log
    shutdown -h +5 "Weekend shutdown in 5 minutes"
fi
EOF
    chmod +x /usr/local/bin/weekend-shutdown.sh
    echo "0 20 * * 5 /usr/local/bin/weekend-shutdown.sh" >> /var/spool/cron/root
fi

# Final system configuration
log "Finalizing system configuration"

# Optimize system for cost efficiency
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'net.core.somaxconn = 65535' >> /etc/sysctl.conf
sysctl -p

# Create status file
echo "User data script completed successfully at $(date)" > /tmp/user-data-complete

log "User data script completed successfully"

# Send completion notification
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
aws sns publish --region "$REGION" --topic-arn "${sns_topic_arn}" --message "Instance $INSTANCE_ID initialization completed successfully" || true

exit 0