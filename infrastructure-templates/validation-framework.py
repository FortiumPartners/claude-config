#!/usr/bin/env python3
"""
Infrastructure Validation and Testing Framework
Comprehensive validation for Terraform, Kubernetes, and Docker configurations
Part of Infrastructure Management Subagent v1.0
"""

import os
import sys
import json
import yaml
import subprocess
import tempfile
import time
import argparse
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

class ValidationSeverity(Enum):
    INFO = "info"
    WARNING = "warning" 
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class ValidationResult:
    severity: ValidationSeverity
    category: str
    message: str
    file_path: str = ""
    line_number: int = 0
    details: Dict[str, Any] = None

class InfrastructureValidator:
    """
    Comprehensive validation framework for infrastructure configurations
    with security scanning, performance validation, and best practices enforcement.
    """
    
    def __init__(self):
        self.results: List[ValidationResult] = []
        self.security_tools = {
            'terraform': ['tfsec', 'checkov'],
            'kubernetes': ['kube-score', 'polaris'],
            'docker': ['trivy', 'hadolint']
        }
        
    def validate_terraform_configuration(self, config_path: Path) -> List[ValidationResult]:
        """
        Validate Terraform configuration for security, performance, and best practices.
        
        Args:
            config_path: Path to Terraform configuration directory
            
        Returns:
            List of validation results
        """
        results = []
        
        # Basic syntax validation
        results.extend(self._validate_terraform_syntax(config_path))
        
        # Security scanning with tfsec
        if self._is_tool_available('tfsec'):
            results.extend(self._run_tfsec(config_path))
        else:
            results.append(ValidationResult(
                ValidationSeverity.WARNING,
                "security",
                "tfsec not available - skipping Terraform security scan"
            ))
            
        # Policy validation with Checkov
        if self._is_tool_available('checkov'):
            results.extend(self._run_checkov(config_path))
            
        # Best practices validation
        results.extend(self._validate_terraform_best_practices(config_path))
        
        return results
        
    def validate_kubernetes_manifests(self, manifest_path: Path) -> List[ValidationResult]:
        """
        Validate Kubernetes manifests for security, reliability, and best practices.
        
        Args:
            manifest_path: Path to Kubernetes manifest file or directory
            
        Returns:
            List of validation results
        """
        results = []
        
        # YAML syntax validation
        results.extend(self._validate_yaml_syntax(manifest_path))
        
        # kubectl dry-run validation
        if self._is_tool_available('kubectl'):
            results.extend(self._run_kubectl_validation(manifest_path))
            
        # Security scanning with kube-score
        if self._is_tool_available('kube-score'):
            results.extend(self._run_kube_score(manifest_path))
            
        # Best practices validation
        results.extend(self._validate_kubernetes_best_practices(manifest_path))
        
        return results
        
    def validate_docker_configuration(self, dockerfile_path: Path) -> List[ValidationResult]:
        """
        Validate Docker configuration for security and optimization.
        
        Args:
            dockerfile_path: Path to Dockerfile
            
        Returns:
            List of validation results
        """
        results = []
        
        # Dockerfile linting with hadolint
        if self._is_tool_available('hadolint'):
            results.extend(self._run_hadolint(dockerfile_path))
            
        # Security best practices validation
        results.extend(self._validate_dockerfile_security(dockerfile_path))
        
        # Build optimization validation
        results.extend(self._validate_dockerfile_optimization(dockerfile_path))
        
        return results
        
    def performance_test_infrastructure(self, config: Dict[str, Any]) -> List[ValidationResult]:
        """
        Run performance tests on infrastructure configurations.
        
        Args:
            config: Infrastructure configuration
            
        Returns:
            List of validation results
        """
        results = []
        
        # Terraform plan performance
        if config.get('terraform_dir'):
            results.extend(self._test_terraform_performance(Path(config['terraform_dir'])))
            
        # Kubernetes resource validation
        if config.get('kubernetes_manifests'):
            results.extend(self._test_kubernetes_performance(Path(config['kubernetes_manifests'])))
            
        return results
        
    def _validate_terraform_syntax(self, config_path: Path) -> List[ValidationResult]:
        """Validate Terraform syntax and configuration."""
        results = []
        
        if not self._is_tool_available('terraform'):
            results.append(ValidationResult(
                ValidationSeverity.ERROR,
                "tools",
                "Terraform CLI not available"
            ))
            return results
            
        try:
            # Run terraform validate
            cmd = ['terraform', 'validate', '-json']
            result = subprocess.run(cmd, cwd=config_path, capture_output=True, text=True)
            
            if result.returncode == 0:
                validation_output = json.loads(result.stdout)
                if validation_output.get('valid'):
                    results.append(ValidationResult(
                        ValidationSeverity.INFO,
                        "syntax",
                        "Terraform configuration is valid",
                        str(config_path)
                    ))
                else:
                    for diagnostic in validation_output.get('diagnostics', []):
                        severity = ValidationSeverity.ERROR if diagnostic['severity'] == 'error' else ValidationSeverity.WARNING
                        results.append(ValidationResult(
                            severity,
                            "syntax",
                            diagnostic['summary'],
                            diagnostic.get('range', {}).get('filename', ''),
                            diagnostic.get('range', {}).get('start', {}).get('line', 0),
                            diagnostic
                        ))
            else:
                results.append(ValidationResult(
                    ValidationSeverity.ERROR,
                    "syntax",
                    f"Terraform validation failed: {result.stderr}",
                    str(config_path)
                ))
                
        except Exception as e:
            results.append(ValidationResult(
                ValidationSeverity.ERROR,
                "validation",
                f"Error running terraform validate: {str(e)}",
                str(config_path)
            ))
            
        return results
        
    def _run_tfsec(self, config_path: Path) -> List[ValidationResult]:
        """Run tfsec security scanning."""
        results = []
        
        try:
            cmd = ['tfsec', '--format', 'json', str(config_path)]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.stdout:
                tfsec_output = json.loads(result.stdout)
                
                for finding in tfsec_output.get('results', []):
                    severity = self._map_tfsec_severity(finding.get('severity', 'medium'))
                    results.append(ValidationResult(
                        severity,
                        "security",
                        f"[{finding.get('rule_id', 'unknown')}] {finding.get('description', 'Security issue')}",
                        finding.get('location', {}).get('filename', ''),
                        finding.get('location', {}).get('start_line', 0),
                        finding
                    ))
                    
        except Exception as e:
            results.append(ValidationResult(
                ValidationSeverity.WARNING,
                "security",
                f"Error running tfsec: {str(e)}"
            ))
            
        return results
        
    def _run_checkov(self, config_path: Path) -> List[ValidationResult]:
        """Run Checkov security and compliance scanning."""
        results = []
        
        try:
            cmd = ['checkov', '-d', str(config_path), '--output', 'json', '--quiet']
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.stdout:
                checkov_output = json.loads(result.stdout)
                
                for check_result in checkov_output.get('results', {}).get('failed_checks', []):
                    results.append(ValidationResult(
                        ValidationSeverity.WARNING,
                        "compliance",
                        f"[{check_result.get('check_id', 'unknown')}] {check_result.get('check_name', 'Compliance issue')}",
                        check_result.get('file_path', ''),
                        check_result.get('file_line_range', [0])[0],
                        check_result
                    ))
                    
        except Exception as e:
            results.append(ValidationResult(
                ValidationSeverity.WARNING,
                "compliance",
                f"Error running Checkov: {str(e)}"
            ))
            
        return results
        
    def _validate_yaml_syntax(self, manifest_path: Path) -> List[ValidationResult]:
        """Validate YAML syntax in Kubernetes manifests."""
        results = []
        
        if manifest_path.is_file():
            files_to_check = [manifest_path]
        else:
            files_to_check = list(manifest_path.glob('*.yaml')) + list(manifest_path.glob('*.yml'))
            
        for file_path in files_to_check:
            try:
                with open(file_path, 'r') as f:
                    list(yaml.safe_load_all(f.read()))
                    
                results.append(ValidationResult(
                    ValidationSeverity.INFO,
                    "syntax",
                    "Valid YAML syntax",
                    str(file_path)
                ))
                
            except yaml.YAMLError as e:
                results.append(ValidationResult(
                    ValidationSeverity.ERROR,
                    "syntax",
                    f"YAML syntax error: {str(e)}",
                    str(file_path),
                    getattr(e, 'problem_mark', {}).get('line', 0) + 1 if hasattr(e, 'problem_mark') else 0
                ))
                
        return results
        
    def _run_kubectl_validation(self, manifest_path: Path) -> List[ValidationResult]:
        """Run kubectl dry-run validation."""
        results = []
        
        try:
            cmd = ['kubectl', 'apply', '--dry-run=client', '--validate=true', '-f', str(manifest_path)]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                results.append(ValidationResult(
                    ValidationSeverity.INFO,
                    "validation",
                    "kubectl dry-run validation passed",
                    str(manifest_path)
                ))
            else:
                results.append(ValidationResult(
                    ValidationSeverity.ERROR,
                    "validation",
                    f"kubectl validation failed: {result.stderr}",
                    str(manifest_path)
                ))
                
        except Exception as e:
            results.append(ValidationResult(
                ValidationSeverity.WARNING,
                "validation",
                f"Error running kubectl validation: {str(e)}"
            ))
            
        return results
        
    def _run_kube_score(self, manifest_path: Path) -> List[ValidationResult]:
        """Run kube-score security and best practices validation."""
        results = []
        
        try:
            cmd = ['kube-score', 'score', str(manifest_path), '--output-format', 'json']
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.stdout:
                # kube-score JSON output parsing
                for line in result.stdout.split('\n'):
                    if line.strip():
                        try:
                            score_result = json.loads(line)
                            for check in score_result.get('checks', []):
                                if check['grade'] not in ['GRADE_ALLOK']:
                                    severity = ValidationSeverity.WARNING if check['grade'] == 'GRADE_WARNING' else ValidationSeverity.ERROR
                                    results.append(ValidationResult(
                                        severity,
                                        "security",
                                        f"[{check['check']['id']}] {check['comments'][0]['summary'] if check['comments'] else check['check']['comment']}",
                                        str(manifest_path),
                                        0,
                                        check
                                    ))
                        except json.JSONDecodeError:
                            continue
                            
        except Exception as e:
            results.append(ValidationResult(
                ValidationSeverity.WARNING,
                "security",
                f"Error running kube-score: {str(e)}"
            ))
            
        return results
        
    def _run_hadolint(self, dockerfile_path: Path) -> List[ValidationResult]:
        """Run Hadolint Docker best practices validation."""
        results = []
        
        try:
            cmd = ['hadolint', '--format', 'json', str(dockerfile_path)]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.stdout:
                hadolint_results = json.loads(result.stdout)
                
                for finding in hadolint_results:
                    severity = self._map_hadolint_level(finding.get('level', 'info'))
                    results.append(ValidationResult(
                        severity,
                        "docker",
                        f"[{finding.get('code', 'unknown')}] {finding.get('message', 'Docker issue')}",
                        str(dockerfile_path),
                        finding.get('line', 0),
                        finding
                    ))
                    
        except Exception as e:
            results.append(ValidationResult(
                ValidationSeverity.WARNING,
                "docker",
                f"Error running Hadolint: {str(e)}"
            ))
            
        return results
        
    def _validate_dockerfile_security(self, dockerfile_path: Path) -> List[ValidationResult]:
        """Validate Dockerfile for security best practices."""
        results = []
        
        try:
            with open(dockerfile_path, 'r') as f:
                content = f.read()
                lines = content.split('\n')
                
            has_user = False
            has_healthcheck = False
            root_user_line = 0
            
            for i, line in enumerate(lines, 1):
                line = line.strip()
                
                # Check for USER instruction
                if line.startswith('USER '):
                    has_user = True
                    user_value = line.split(' ', 1)[1]
                    if user_value in ['0', 'root']:
                        root_user_line = i
                        
                # Check for HEALTHCHECK
                if line.startswith('HEALTHCHECK'):
                    has_healthcheck = True
                    
                # Check for security anti-patterns
                if 'chmod 777' in line or 'chmod 666' in line:
                    results.append(ValidationResult(
                        ValidationSeverity.WARNING,
                        "security",
                        "Overly permissive file permissions (777/666)",
                        str(dockerfile_path),
                        i
                    ))
                    
                if 'ADD http' in line or 'ADD https' in line:
                    results.append(ValidationResult(
                        ValidationSeverity.WARNING,
                        "security",
                        "Consider using COPY + RUN wget/curl instead of ADD for URLs",
                        str(dockerfile_path),
                        i
                    ))
                    
            # Security checks
            if not has_user:
                results.append(ValidationResult(
                    ValidationSeverity.WARNING,
                    "security",
                    "No USER instruction found - container will run as root",
                    str(dockerfile_path)
                ))
            elif root_user_line > 0:
                results.append(ValidationResult(
                    ValidationSeverity.ERROR,
                    "security",
                    "Container configured to run as root user",
                    str(dockerfile_path),
                    root_user_line
                ))
                
            if not has_healthcheck:
                results.append(ValidationResult(
                    ValidationSeverity.INFO,
                    "reliability",
                    "Consider adding HEALTHCHECK instruction",
                    str(dockerfile_path)
                ))
                
        except Exception as e:
            results.append(ValidationResult(
                ValidationSeverity.ERROR,
                "validation",
                f"Error reading Dockerfile: {str(e)}",
                str(dockerfile_path)
            ))
            
        return results
        
    def _test_terraform_performance(self, config_path: Path) -> List[ValidationResult]:
        """Test Terraform plan performance."""
        results = []
        
        if not self._is_tool_available('terraform'):
            return results
            
        try:
            start_time = time.time()
            
            # Run terraform plan
            cmd = ['terraform', 'plan', '-input=false', '-detailed-exitcode']
            result = subprocess.run(cmd, cwd=config_path, capture_output=True, text=True)
            
            duration = time.time() - start_time
            
            # Performance targets
            if duration < 60:  # Less than 1 minute
                results.append(ValidationResult(
                    ValidationSeverity.INFO,
                    "performance",
                    f"Terraform plan completed in {duration:.1f}s (target: <60s)",
                    str(config_path),
                    details={'duration': duration, 'target': 60}
                ))
            elif duration < 120:  # Less than 2 minutes
                results.append(ValidationResult(
                    ValidationSeverity.WARNING,
                    "performance",
                    f"Terraform plan took {duration:.1f}s (target: <60s, max: 120s)",
                    str(config_path),
                    details={'duration': duration, 'target': 60}
                ))
            else:
                results.append(ValidationResult(
                    ValidationSeverity.ERROR,
                    "performance",
                    f"Terraform plan exceeded 2 minutes ({duration:.1f}s)",
                    str(config_path),
                    details={'duration': duration, 'target': 60}
                ))
                
        except Exception as e:
            results.append(ValidationResult(
                ValidationSeverity.WARNING,
                "performance",
                f"Could not test Terraform performance: {str(e)}"
            ))
            
        return results
        
    def _is_tool_available(self, tool_name: str) -> bool:
        """Check if a CLI tool is available."""
        try:
            subprocess.run([tool_name, '--version'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
            
    def _map_tfsec_severity(self, tfsec_severity: str) -> ValidationSeverity:
        """Map tfsec severity to ValidationSeverity."""
        mapping = {
            'critical': ValidationSeverity.CRITICAL,
            'high': ValidationSeverity.ERROR,
            'medium': ValidationSeverity.WARNING,
            'low': ValidationSeverity.INFO
        }
        return mapping.get(tfsec_severity.lower(), ValidationSeverity.WARNING)
        
    def _map_hadolint_level(self, hadolint_level: str) -> ValidationSeverity:
        """Map Hadolint level to ValidationSeverity."""
        mapping = {
            'error': ValidationSeverity.ERROR,
            'warning': ValidationSeverity.WARNING,
            'info': ValidationSeverity.INFO,
            'style': ValidationSeverity.INFO
        }
        return mapping.get(hadolint_level.lower(), ValidationSeverity.INFO)
        
    def generate_report(self, results: List[ValidationResult], output_format: str = 'text') -> str:
        """Generate validation report."""
        
        if output_format == 'json':
            return self._generate_json_report(results)
        elif output_format == 'html':
            return self._generate_html_report(results)
        else:
            return self._generate_text_report(results)
            
    def _generate_text_report(self, results: List[ValidationResult]) -> str:
        """Generate text format report."""
        
        report_lines = [
            "Infrastructure Validation Report",
            "=" * 50,
            f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            ""
        ]
        
        # Summary
        severity_counts = {severity: 0 for severity in ValidationSeverity}
        for result in results:
            severity_counts[result.severity] += 1
            
        report_lines.extend([
            "Summary:",
            f"  Critical: {severity_counts[ValidationSeverity.CRITICAL]}",
            f"  Errors:   {severity_counts[ValidationSeverity.ERROR]}",
            f"  Warnings: {severity_counts[ValidationSeverity.WARNING]}",
            f"  Info:     {severity_counts[ValidationSeverity.INFO]}",
            ""
        ])
        
        # Group by category
        categories = {}
        for result in results:
            if result.category not in categories:
                categories[result.category] = []
            categories[result.category].append(result)
            
        # Generate findings by category
        for category, category_results in categories.items():
            report_lines.extend([
                f"{category.upper()} ({len(category_results)} findings):",
                "-" * 30
            ])
            
            for result in category_results:
                severity_icon = {
                    ValidationSeverity.CRITICAL: "🔴",
                    ValidationSeverity.ERROR: "❌",
                    ValidationSeverity.WARNING: "⚠️ ",
                    ValidationSeverity.INFO: "ℹ️ "
                }[result.severity]
                
                location = ""
                if result.file_path:
                    location = f" ({result.file_path}"
                    if result.line_number:
                        location += f":{result.line_number}"
                    location += ")"
                    
                report_lines.append(f"  {severity_icon} {result.message}{location}")
                
            report_lines.append("")
            
        return '\n'.join(report_lines)
        
    def _generate_json_report(self, results: List[ValidationResult]) -> str:
        """Generate JSON format report."""
        
        report_data = {
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'summary': {
                'total': len(results),
                'critical': len([r for r in results if r.severity == ValidationSeverity.CRITICAL]),
                'errors': len([r for r in results if r.severity == ValidationSeverity.ERROR]),
                'warnings': len([r for r in results if r.severity == ValidationSeverity.WARNING]),
                'info': len([r for r in results if r.severity == ValidationSeverity.INFO])
            },
            'findings': []
        }
        
        for result in results:
            finding = {
                'severity': result.severity.value,
                'category': result.category,
                'message': result.message,
                'file_path': result.file_path,
                'line_number': result.line_number
            }
            
            if result.details:
                finding['details'] = result.details
                
            report_data['findings'].append(finding)
            
        return json.dumps(report_data, indent=2)


def main():
    """Command-line interface for Infrastructure Validator."""
    
    parser = argparse.ArgumentParser(
        description='Validate infrastructure configurations',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('type',
                       choices=['terraform', 'kubernetes', 'docker', 'all'],
                       help='Type of validation to perform')
    
    parser.add_argument('path',
                       help='Path to configuration file or directory')
    
    parser.add_argument('--output-format', '-f',
                       choices=['text', 'json', 'html'],
                       default='text',
                       help='Output format for report')
    
    parser.add_argument('--output-file', '-o',
                       help='Output file for report')
    
    parser.add_argument('--performance',
                       action='store_true',
                       help='Include performance testing')
    
    parser.add_argument('--fail-on-error',
                       action='store_true',
                       help='Exit with code 1 if errors found')
    
    args = parser.parse_args()
    
    validator = InfrastructureValidator()
    all_results = []
    
    config_path = Path(args.path)
    
    if args.type in ['terraform', 'all']:
        print("🔍 Validating Terraform configuration...")
        all_results.extend(validator.validate_terraform_configuration(config_path))
        
    if args.type in ['kubernetes', 'all']:
        print("🔍 Validating Kubernetes manifests...")
        all_results.extend(validator.validate_kubernetes_manifests(config_path))
        
    if args.type in ['docker', 'all']:
        print("🔍 Validating Docker configuration...")
        dockerfile_path = config_path / 'Dockerfile' if config_path.is_dir() else config_path
        if dockerfile_path.exists():
            all_results.extend(validator.validate_docker_configuration(dockerfile_path))
        else:
            print("⚠️  No Dockerfile found")
            
    if args.performance:
        print("⚡ Running performance tests...")
        config = {'terraform_dir': str(config_path)} if args.type == 'terraform' else {}
        all_results.extend(validator.performance_test_infrastructure(config))
        
    # Generate report
    report = validator.generate_report(all_results, args.output_format)
    
    if args.output_file:
        with open(args.output_file, 'w') as f:
            f.write(report)
        print(f"📄 Report saved to {args.output_file}")
    else:
        print(report)
        
    # Exit with error code if critical issues or errors found
    if args.fail_on_error:
        critical_or_error_count = len([
            r for r in all_results 
            if r.severity in [ValidationSeverity.CRITICAL, ValidationSeverity.ERROR]
        ])
        
        if critical_or_error_count > 0:
            print(f"\n❌ Validation failed with {critical_or_error_count} critical/error findings")
            sys.exit(1)
        else:
            print("\n✅ All validations passed")


if __name__ == '__main__':
    main()