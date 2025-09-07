#!/usr/bin/env python3
"""
Kubernetes Manifest Generation Engine
Production-ready Kubernetes configurations with security best practices
Part of Infrastructure Management Subagent v1.0
"""

import os
import sys
import json
import yaml
import argparse
from typing import Dict, Any, List, Optional
from pathlib import Path
import subprocess
from datetime import datetime
import re

class KubernetesManifestGenerator:
    """
    Advanced Kubernetes manifest generation with security hardening,
    performance optimization, and best practices enforcement.
    """
    
    def __init__(self, template_dir: str = None):
        self.template_dir = Path(template_dir) if template_dir else Path(__file__).parent
        self.templates = {
            'deployment': 'deployment-template.yaml',
            'service': 'service-template.yaml',
            'ingress': 'ingress-template.yaml',
            'configmap': 'configmap-secret-template.yaml',
            'secret': 'configmap-secret-template.yaml',
            'pvc': 'persistent-volume-template.yaml',
            'storageclass': 'persistent-volume-template.yaml'
        }
        
    def generate_manifest(self, template_type: str, config: Dict[str, Any], 
                         output_file: str = None) -> str:
        """
        Generate Kubernetes manifest from template and configuration.
        
        Args:
            template_type: Type of template (deployment, service, etc.)
            config: Configuration variables for template rendering
            output_file: Optional output file path
            
        Returns:
            Generated manifest as string
        """
        if template_type not in self.templates:
            raise ValueError(f"Unknown template type: {template_type}")
            
        template_path = self.template_dir / self.templates[template_type]
        
        if not template_path.exists():
            raise FileNotFoundError(f"Template not found: {template_path}")
            
        # Load template content
        with open(template_path, 'r') as f:
            template_content = f.read()
            
        # Apply security defaults
        config = self._apply_security_defaults(config, template_type)
        
        # Render template with Jinja2-like variable substitution
        rendered_manifest = self._render_template(template_content, config)
        
        # Validate generated manifest
        validation_result = self._validate_manifest(rendered_manifest, template_type)
        
        if not validation_result['valid']:
            raise ValueError(f"Generated manifest validation failed: {validation_result['errors']}")
            
        # Save to file if specified
        if output_file:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w') as f:
                f.write(rendered_manifest)
                
            print(f"Generated {template_type} manifest: {output_path}")
            
        return rendered_manifest
        
    def _apply_security_defaults(self, config: Dict[str, Any], template_type: str) -> Dict[str, Any]:
        """Apply security best practices and defaults."""
        
        # Security defaults for all templates
        security_defaults = {
            'READ_ONLY_ROOT': True,
            'RUN_AS_USER': 1001,
            'RUN_AS_GROUP': 3000,
            'FS_GROUP': 2000,
            'REQUIRED_CAPABILITIES': [],
            'MEMORY_REQUEST': '256Mi',
            'MEMORY_LIMIT': '512Mi',
            'CPU_REQUEST': '100m',
            'CPU_LIMIT': '500m',
        }
        
        # Template-specific security defaults
        if template_type == 'deployment':
            security_defaults.update({
                'ENABLE_PDB': True,
                'PDB_MAX_UNAVAILABLE': '25%',
                'LIVENESS_INITIAL_DELAY': 30,
                'READINESS_INITIAL_DELAY': 5,
                'TERMINATION_GRACE_PERIOD': 30,
            })
            
        elif template_type == 'service':
            security_defaults.update({
                'SESSION_AFFINITY': 'None',
                'EXTERNAL_TRAFFIC_POLICY': 'Cluster',
            })
            
        elif template_type == 'ingress':
            security_defaults.update({
                'TLS_ENABLED': True,
                'NGINX_SSL_REDIRECT': True,
                'ENABLE_NETWORK_POLICY': True,
            })
            
        # Merge with user config, giving priority to user values
        merged_config = {**security_defaults, **config}
        
        # Validate security requirements
        self._validate_security_config(merged_config, template_type)
        
        return merged_config
        
    def _validate_security_config(self, config: Dict[str, Any], template_type: str):
        """Validate security configuration requirements."""
        
        security_issues = []
        
        # Check for non-root user
        if config.get('RUN_AS_USER', 0) == 0:
            security_issues.append("Container should not run as root user (UID 0)")
            
        # Check for privilege escalation
        if config.get('ALLOW_PRIVILEGE_ESCALATION', False):
            security_issues.append("allowPrivilegeEscalation should be false")
            
        # Check for dangerous capabilities
        dangerous_caps = ['SYS_ADMIN', 'NET_ADMIN', 'SYS_PTRACE', 'SYS_MODULE']
        required_caps = config.get('REQUIRED_CAPABILITIES', [])
        for cap in dangerous_caps:
            if cap in required_caps:
                security_issues.append(f"Dangerous capability requested: {cap}")
                
        # Check resource limits
        if not config.get('MEMORY_LIMIT'):
            security_issues.append("Memory limits should be specified")
            
        if not config.get('CPU_LIMIT'):
            security_issues.append("CPU limits should be specified")
            
        # Check for TLS in ingress
        if template_type == 'ingress' and not config.get('TLS_ENABLED', False):
            security_issues.append("TLS should be enabled for ingress")
            
        if security_issues:
            print(f"Security warnings for {template_type}:")
            for issue in security_issues:
                print(f"  ⚠️  {issue}")
                
    def _render_template(self, template: str, config: Dict[str, Any]) -> str:
        """
        Simple template rendering for Jinja2-like syntax.
        Supports variable substitution and basic conditionals.
        """
        
        # Handle variable substitution {{ VAR }}
        def replace_var(match):
            var_expr = match.group(1).strip()
            
            # Handle default values: {{ VAR | default("value") }}
            if '|' in var_expr:
                var_name, default_expr = var_expr.split('|', 1)
                var_name = var_name.strip()
                default_match = re.search(r'default\(["\']?([^"\']*)["\']?\)', default_expr)
                default_value = default_match.group(1) if default_match else ''
                return str(config.get(var_name, default_value))
            else:
                return str(config.get(var_expr, ''))
                
        template = re.sub(r'\{\{\s*([^}]+)\s*\}\}', replace_var, template)
        
        # Handle conditional blocks {% if CONDITION %}
        def process_conditionals(text):
            lines = text.split('\n')
            result_lines = []
            skip_block = False
            condition_stack = []
            
            for line in lines:
                # Check for if statement
                if_match = re.search(r'\{\%\s*if\s+(\w+)\s*\%\}', line)
                if if_match:
                    condition = if_match.group(1)
                    condition_met = bool(config.get(condition))
                    condition_stack.append(condition_met)
                    skip_block = not condition_met
                    continue
                    
                # Check for else statement
                elif re.search(r'\{\%\s*else\s*\%\}', line):
                    if condition_stack:
                        skip_block = not skip_block
                    continue
                    
                # Check for endif statement
                elif re.search(r'\{\%\s*endif\s*\%\}', line):
                    if condition_stack:
                        condition_stack.pop()
                        skip_block = len(condition_stack) > 0 and not condition_stack[-1]
                    continue
                    
                # Add line if not in skipped block
                if not skip_block:
                    result_lines.append(line)
                    
            return '\n'.join(result_lines)
            
        template = process_conditionals(template)
        
        # Handle for loops {% for item in ITEMS %}
        def process_loops(text):
            lines = text.split('\n')
            result_lines = []
            i = 0
            
            while i < len(lines):
                line = lines[i]
                
                # Check for for loop
                for_match = re.search(r'\{\%\s*for\s+(\w+)\s+in\s+(\w+)\s*\%\}', line)
                if for_match:
                    loop_var = for_match.group(1)
                    list_var = for_match.group(2)
                    
                    # Find the end of the loop
                    loop_lines = []
                    i += 1
                    while i < len(lines) and not re.search(r'\{\%\s*endfor\s*\%\}', lines[i]):
                        loop_lines.append(lines[i])
                        i += 1
                        
                    # Process loop items
                    items = config.get(list_var, [])
                    if isinstance(items, list):
                        for item in items:
                            # Create temporary config with loop variable
                            loop_config = {**config, loop_var: item}
                            
                            for loop_line in loop_lines:
                                # Replace loop variable references
                                processed_line = re.sub(
                                    r'\{\{\s*' + loop_var + r'\.(\w+)\s*\}\}',
                                    lambda m: str(item.get(m.group(1), '') if isinstance(item, dict) else ''),
                                    loop_line
                                )
                                processed_line = re.sub(
                                    r'\{\{\s*' + loop_var + r'\s*\}\}',
                                    str(item),
                                    processed_line
                                )
                                result_lines.append(processed_line)
                                
                    i += 1  # Skip endfor line
                    continue
                    
                result_lines.append(line)
                i += 1
                
            return '\n'.join(result_lines)
            
        template = process_loops(template)
        
        # Clean up empty lines and normalize YAML
        lines = template.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Skip lines that contain only template artifacts
            if re.match(r'^\s*[\{\%].*[\%\}]\s*$', line):
                continue
            cleaned_lines.append(line)
            
        return '\n'.join(cleaned_lines)
        
    def _validate_manifest(self, manifest: str, template_type: str) -> Dict[str, Any]:
        """Validate generated Kubernetes manifest."""
        
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Parse YAML
            docs = list(yaml.safe_load_all(manifest))
            
            for doc in docs:
                if not doc:  # Skip empty documents
                    continue
                    
                # Basic structure validation
                if not isinstance(doc, dict):
                    validation_result['errors'].append("Document must be a dictionary")
                    continue
                    
                if 'apiVersion' not in doc:
                    validation_result['errors'].append("Missing apiVersion field")
                    
                if 'kind' not in doc:
                    validation_result['errors'].append("Missing kind field")
                    
                if 'metadata' not in doc or 'name' not in doc.get('metadata', {}):
                    validation_result['errors'].append("Missing metadata.name field")
                    
                # Template-specific validation
                self._validate_template_specific(doc, template_type, validation_result)
                
        except yaml.YAMLError as e:
            validation_result['errors'].append(f"YAML parsing error: {str(e)}")
            
        validation_result['valid'] = len(validation_result['errors']) == 0
        
        return validation_result
        
    def _validate_template_specific(self, doc: Dict[str, Any], template_type: str, 
                                  validation_result: Dict[str, Any]):
        """Perform template-specific validation."""
        
        kind = doc.get('kind', '')
        
        if template_type == 'deployment' and kind == 'Deployment':
            spec = doc.get('spec', {})
            template = spec.get('template', {})
            containers = template.get('spec', {}).get('containers', [])
            
            for container in containers:
                # Check security context
                security_context = container.get('securityContext', {})
                
                if security_context.get('allowPrivilegeEscalation', True):
                    validation_result['warnings'].append(
                        f"Container {container.get('name')} allows privilege escalation"
                    )
                    
                if not security_context.get('readOnlyRootFilesystem', False):
                    validation_result['warnings'].append(
                        f"Container {container.get('name')} does not use read-only root filesystem"
                    )
                    
                # Check resource limits
                resources = container.get('resources', {})
                if not resources.get('limits'):
                    validation_result['warnings'].append(
                        f"Container {container.get('name')} has no resource limits"
                    )
                    
                # Check health checks
                if not container.get('livenessProbe'):
                    validation_result['warnings'].append(
                        f"Container {container.get('name')} has no liveness probe"
                    )
                    
                if not container.get('readinessProbe'):
                    validation_result['warnings'].append(
                        f"Container {container.get('name')} has no readiness probe"
                    )
                    
    def kubectl_dry_run_validation(self, manifest: str) -> Dict[str, Any]:
        """
        Validate manifest using kubectl dry-run.
        Requires kubectl to be installed and configured.
        """
        
        validation_result = {
            'valid': True,
            'errors': [],
            'kubectl_available': False
        }
        
        try:
            # Check if kubectl is available
            subprocess.run(['kubectl', 'version', '--client'], 
                         capture_output=True, check=True)
            validation_result['kubectl_available'] = True
            
            # Perform dry-run validation
            result = subprocess.run(
                ['kubectl', 'apply', '--dry-run=client', '--validate=true', '-f', '-'],
                input=manifest.encode(),
                capture_output=True,
                text=False
            )
            
            if result.returncode != 0:
                validation_result['valid'] = False
                validation_result['errors'].append(
                    f"kubectl validation failed: {result.stderr.decode()}"
                )
                
        except subprocess.CalledProcessError:
            validation_result['kubectl_available'] = False
            
        except FileNotFoundError:
            validation_result['kubectl_available'] = False
            
        return validation_result
        
    def generate_application_stack(self, config: Dict[str, Any], output_dir: str = None) -> Dict[str, str]:
        """
        Generate complete application stack with all required resources.
        
        Args:
            config: Application configuration
            output_dir: Directory to save generated manifests
            
        Returns:
            Dictionary mapping resource types to generated manifests
        """
        
        app_name = config.get('APP_NAME', 'my-app')
        output_dir = Path(output_dir) if output_dir else Path(f"./{app_name}-manifests")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        manifests = {}
        
        # Core resources
        resource_types = ['deployment', 'service']
        
        # Optional resources based on configuration
        if config.get('ENABLE_INGRESS', False):
            resource_types.append('ingress')
            
        if config.get('ENABLE_CONFIGMAP', False) or config.get('CONFIG_DATA'):
            resource_types.append('configmap')
            
        if config.get('ENABLE_SECRET', False) or config.get('SECRET_DATA'):
            resource_types.append('secret')
            
        if config.get('ENABLE_PVC', False):
            resource_types.extend(['storageclass', 'pvc'])
            
        # Generate each resource type
        for resource_type in resource_types:
            try:
                output_file = output_dir / f"{app_name}-{resource_type}.yaml"
                
                manifest = self.generate_manifest(
                    template_type=resource_type,
                    config=config,
                    output_file=str(output_file)
                )
                
                manifests[resource_type] = manifest
                
            except Exception as e:
                print(f"Error generating {resource_type}: {str(e)}")
                
        # Generate deployment script
        self._generate_deployment_script(config, output_dir, list(manifests.keys()))
        
        # Generate validation script
        self._generate_validation_script(config, output_dir)
        
        print(f"\n✅ Generated {len(manifests)} manifest files in {output_dir}")
        print(f"📁 Deployment script: {output_dir}/deploy.sh")
        print(f"🔍 Validation script: {output_dir}/validate.sh")
        
        return manifests
        
    def _generate_deployment_script(self, config: Dict[str, Any], output_dir: Path, 
                                  resource_types: List[str]):
        """Generate deployment script for the application stack."""
        
        app_name = config.get('APP_NAME', 'my-app')
        namespace = config.get('NAMESPACE', 'default')
        
        script_content = f"""#!/bin/bash
# Deployment script for {app_name}
# Generated by Infrastructure Management Subagent

set -euo pipefail

# Configuration
APP_NAME="{app_name}"
NAMESPACE="{namespace}"
SCRIPT_DIR="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Logging functions
log_info() {{
    echo -e "${{GREEN}}[INFO]${{NC}} $1"
}}

log_warn() {{
    echo -e "${{YELLOW}}[WARN]${{NC}} $1"
}}

log_error() {{
    echo -e "${{RED}}[ERROR]${{NC}} $1"
}}

# Check prerequisites
check_prerequisites() {{
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to connect to Kubernetes cluster"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}}

# Create namespace if it doesn't exist
ensure_namespace() {{
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Creating namespace: $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
    else
        log_info "Namespace $NAMESPACE already exists"
    fi
}}

# Deploy resources in correct order
deploy_resources() {{
    local resources=(
"""
        
        # Add resources in dependency order
        deployment_order = []
        
        if 'storageclass' in resource_types:
            deployment_order.append('storageclass')
        if 'pvc' in resource_types:
            deployment_order.append('pvc')
        if 'configmap' in resource_types:
            deployment_order.append('configmap')
        if 'secret' in resource_types:
            deployment_order.append('secret')
        if 'deployment' in resource_types:
            deployment_order.append('deployment')
        if 'service' in resource_types:
            deployment_order.append('service')
        if 'ingress' in resource_types:
            deployment_order.append('ingress')
            
        for resource in deployment_order:
            script_content += f'        "{app_name}-{resource}.yaml"\n'
            
        script_content += f"""    )
    
    for resource in "${{resources[@]}}"; do
        if [[ -f "$SCRIPT_DIR/$resource" ]]; then
            log_info "Applying $resource..."
            kubectl apply -f "$SCRIPT_DIR/$resource" -n "$NAMESPACE"
        else
            log_warn "Resource file not found: $resource"
        fi
    done
}}

# Wait for deployment to be ready
wait_for_deployment() {{"""
        
        if 'deployment' in resource_types:
            script_content += f"""
    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/{app_name} -n "$NAMESPACE" --timeout=300s
"""
            
        script_content += f"""}}

# Verify deployment
verify_deployment() {{
    log_info "Verifying deployment..."
    
    # Check pod status
    kubectl get pods -n "$NAMESPACE" -l app={app_name}
    
    # Check service endpoints
    kubectl get endpoints -n "$NAMESPACE" -l app={app_name}
    
    log_info "Deployment verification completed"
}}

# Main deployment function
main() {{
    log_info "Starting deployment of $APP_NAME"
    
    check_prerequisites
    ensure_namespace
    deploy_resources
    wait_for_deployment
    verify_deployment
    
    log_info "Deployment completed successfully!"
    log_info "To view resources: kubectl get all -n $NAMESPACE -l app=$APP_NAME"
}}

# Handle script arguments
case "${{1:-deploy}}" in
    deploy)
        main
        ;;
    delete)
        log_info "Deleting $APP_NAME resources..."
        kubectl delete all -n "$NAMESPACE" -l app=$APP_NAME
        log_info "Resources deleted"
        ;;
    status)
        log_info "Status of $APP_NAME resources:"
        kubectl get all -n "$NAMESPACE" -l app=$APP_NAME
        ;;
    logs)
        kubectl logs -n "$NAMESPACE" -l app=$APP_NAME --tail=50 -f
        ;;
    *)
        echo "Usage: $0 {{deploy|delete|status|logs}}"
        echo "  deploy: Deploy the application (default)"
        echo "  delete: Delete all application resources"
        echo "  status: Show status of all resources"
        echo "  logs: Show and follow application logs"
        exit 1
        ;;
esac
"""
        
        script_path = output_dir / "deploy.sh"
        with open(script_path, 'w') as f:
            f.write(script_content)
            
        # Make script executable
        os.chmod(script_path, 0o755)
        
    def _generate_validation_script(self, config: Dict[str, Any], output_dir: Path):
        """Generate validation script for the manifests."""
        
        app_name = config.get('APP_NAME', 'my-app')
        
        script_content = f"""#!/bin/bash
# Validation script for {app_name}
# Generated by Infrastructure Management Subagent

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

log_info() {{ echo -e "${{GREEN}}[INFO]${{NC}} $1"; }}
log_warn() {{ echo -e "${{YELLOW}}[WARN]${{NC}} $1"; }}
log_error() {{ echo -e "${{RED}}[ERROR]${{NC}} $1"; }}

# Validate YAML syntax
validate_yaml() {{
    local file="$1"
    log_info "Validating YAML syntax: $file"
    
    if ! python3 -c "import yaml; yaml.safe_load_all(open('$file'))" 2>/dev/null; then
        log_error "Invalid YAML syntax in $file"
        return 1
    fi
}}

# Validate with kubectl dry-run
validate_kubectl() {{
    local file="$1"
    log_info "Validating with kubectl dry-run: $file"
    
    if ! kubectl apply --dry-run=client --validate=true -f "$file" &>/dev/null; then
        log_error "kubectl validation failed for $file"
        return 1
    fi
}}

# Run security checks
security_check() {{
    local file="$1"
    log_info "Running security checks: $file"
    
    # Check for root user
    if grep -q "runAsUser: 0" "$file"; then
        log_warn "Found container running as root user in $file"
    fi
    
    # Check for privileged containers
    if grep -q "privileged: true" "$file"; then
        log_error "Found privileged container in $file"
    fi
    
    # Check for host network
    if grep -q "hostNetwork: true" "$file"; then
        log_warn "Found host network usage in $file"
    fi
}}

# Main validation
main() {{
    log_info "Starting validation of {app_name} manifests"
    
    local failed=0
    
    for manifest in "$SCRIPT_DIR"/*.yaml; do
        if [[ -f "$manifest" ]]; then
            log_info "Processing: $(basename "$manifest")"
            
            validate_yaml "$manifest" || ((failed++))
            
            if command -v kubectl &>/dev/null; then
                validate_kubectl "$manifest" || ((failed++))
            else
                log_warn "kubectl not available, skipping cluster validation"
            fi
            
            security_check "$manifest"
        fi
    done
    
    if [[ $failed -eq 0 ]]; then
        log_info "All validations passed!"
        exit 0
    else
        log_error "$failed validation(s) failed"
        exit 1
    fi
}}

main "$@"
"""
        
        script_path = output_dir / "validate.sh"
        with open(script_path, 'w') as f:
            f.write(script_content)
            
        # Make script executable
        os.chmod(script_path, 0o755)


def main():
    """Command-line interface for the Kubernetes Manifest Generator."""
    
    parser = argparse.ArgumentParser(
        description='Generate production-ready Kubernetes manifests',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate deployment manifest
  python3 generate-manifests.py deployment --config config.json

  # Generate complete application stack
  python3 generate-manifests.py stack --config config.json --output ./manifests

  # Generate with inline configuration
  python3 generate-manifests.py deployment \\
    --set APP_NAME=my-app \\
    --set IMAGE=nginx:1.21 \\
    --set REPLICAS=3
"""
    )
    
    parser.add_argument('type', 
                       choices=['deployment', 'service', 'ingress', 'configmap', 
                               'secret', 'pvc', 'storageclass', 'stack'],
                       help='Type of manifest to generate')
    
    parser.add_argument('--config', '-c',
                       help='JSON/YAML configuration file')
    
    parser.add_argument('--output', '-o',
                       help='Output file or directory')
    
    parser.add_argument('--set',
                       action='append',
                       help='Set configuration value (KEY=VALUE)')
    
    parser.add_argument('--template-dir',
                       help='Directory containing templates')
    
    parser.add_argument('--validate-only',
                       action='store_true',
                       help='Only validate, do not generate')
    
    parser.add_argument('--dry-run',
                       action='store_true',
                       help='Show what would be generated without creating files')
    
    args = parser.parse_args()
    
    # Initialize generator
    generator = KubernetesManifestGenerator(args.template_dir)
    
    # Load configuration
    config = {}
    
    if args.config:
        config_path = Path(args.config)
        if config_path.exists():
            with open(config_path, 'r') as f:
                if config_path.suffix.lower() in ['.yaml', '.yml']:
                    config = yaml.safe_load(f) or {}
                else:
                    config = json.load(f)
        else:
            print(f"Configuration file not found: {args.config}")
            sys.exit(1)
    
    # Apply command-line overrides
    if args.set:
        for setting in args.set:
            if '=' in setting:
                key, value = setting.split('=', 1)
                # Try to parse as JSON for complex values
                try:
                    config[key] = json.loads(value)
                except json.JSONDecodeError:
                    config[key] = value
            else:
                print(f"Invalid setting format: {setting} (use KEY=VALUE)")
                sys.exit(1)
    
    # Set default app name if not specified
    if not config.get('APP_NAME'):
        config['APP_NAME'] = 'my-app'
    
    try:
        if args.type == 'stack':
            # Generate complete application stack
            if args.dry_run:
                print("Dry-run mode: Would generate application stack with configuration:")
                print(json.dumps(config, indent=2))
            else:
                manifests = generator.generate_application_stack(config, args.output)
                print(f"Generated {len(manifests)} manifests")
        else:
            # Generate single manifest type
            output_file = args.output if not args.dry_run else None
            
            manifest = generator.generate_manifest(args.type, config, output_file)
            
            if args.dry_run:
                print("Generated manifest content:")
                print("=" * 50)
                print(manifest)
            elif not args.output:
                print(manifest)
                
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()