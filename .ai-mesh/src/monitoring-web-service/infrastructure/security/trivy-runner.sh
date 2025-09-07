#!/bin/bash
# Trivy Security Scanning Runner Script
# Task 3.1: Advanced security scanning and validation

set -euo pipefail

# Configuration
IMAGE_NAME="${1:-}"
OUTPUT_DIR="${2:-./trivy-results}"
ENVIRONMENT="${ENVIRONMENT:-development}"
TRIVY_CONFIG="${TRIVY_CONFIG:-./trivy.yaml}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validation
if [[ -z "${IMAGE_NAME}" ]]; then
    echo -e "${RED}Error: Image name is required${NC}"
    echo "Usage: $0 <image-name> [output-dir]"
    exit 1
fi

echo -e "${BLUE}🔍 Starting Trivy security scan${NC}"
echo "Environment: ${ENVIRONMENT}"
echo "Image: ${IMAGE_NAME}"
echo "Output directory: ${OUTPUT_DIR}"

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Update vulnerability database
echo -e "${BLUE}📥 Updating vulnerability database...${NC}"
trivy image --download-db-only

# Run vulnerability scan
echo -e "${BLUE}🔍 Scanning for vulnerabilities...${NC}"
trivy image \
    --format json \
    --output "${OUTPUT_DIR}/vulnerabilities.json" \
    --severity HIGH,CRITICAL \
    "${IMAGE_NAME}"

# Run secret scan
echo -e "${BLUE}🔐 Scanning for secrets...${NC}"
trivy image \
    --scanners secret \
    --format json \
    --output "${OUTPUT_DIR}/secrets.json" \
    "${IMAGE_NAME}"

# Run license scan
echo -e "${BLUE}📄 Scanning for license issues...${NC}"
trivy image \
    --scanners license \
    --format json \
    --output "${OUTPUT_DIR}/licenses.json" \
    "${IMAGE_NAME}"

# Run configuration scan
echo -e "${BLUE}⚙️ Scanning for configuration issues...${NC}"
trivy image \
    --scanners config \
    --format json \
    --output "${OUTPUT_DIR}/configs.json" \
    "${IMAGE_NAME}"

# Generate summary report
echo -e "${BLUE}📊 Generating summary report...${NC}"
cat > "${OUTPUT_DIR}/scan-summary.json" <<EOF
{
  "scan_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "image": "${IMAGE_NAME}",
  "scanner_version": "$(trivy --version | head -n1)",
  "scans_performed": [
    "vulnerabilities",
    "secrets",
    "licenses",
    "configurations"
  ]
}
EOF

# Parse results and provide feedback
parse_results() {
    local scan_type=$1
    local results_file="${OUTPUT_DIR}/${scan_type}.json"
    
    if [[ ! -f "${results_file}" ]]; then
        echo -e "${YELLOW}⚠️ No ${scan_type} results file found${NC}"
        return 0
    fi
    
    case "${scan_type}" in
        "vulnerabilities")
            local critical=$(jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' "${results_file}" 2>/dev/null || echo "0")
            local high=$(jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' "${results_file}" 2>/dev/null || echo "0")
            local medium=$(jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM")] | length' "${results_file}" 2>/dev/null || echo "0")
            local low=$(jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW")] | length' "${results_file}" 2>/dev/null || echo "0")
            
            echo -e "${BLUE}📊 Vulnerability Summary:${NC}"
            echo -e "   Critical: ${critical}"
            echo -e "   High: ${high}"
            echo -e "   Medium: ${medium}"
            echo -e "   Low: ${low}"
            
            if [[ "${critical}" -gt 0 ]]; then
                echo -e "${RED}🚨 Critical vulnerabilities found!${NC}"
                jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | "  - \(.VulnerabilityID): \(.Title)"' "${results_file}" 2>/dev/null || echo "  - Error parsing critical vulnerabilities"
                return 1
            fi
            ;;
            
        "secrets")
            local secret_count=$(jq -r '[.Results[]?.Secrets[]?] | length' "${results_file}" 2>/dev/null || echo "0")
            
            echo -e "${BLUE}🔐 Secrets Summary:${NC}"
            echo -e "   Secrets found: ${secret_count}"
            
            if [[ "${secret_count}" -gt 0 ]]; then
                echo -e "${RED}🚨 Secrets detected in image!${NC}"
                jq -r '.Results[]?.Secrets[]? | "  - \(.RuleID): \(.Title) (Line: \(.StartLine))"' "${results_file}" 2>/dev/null || echo "  - Error parsing secrets"
                return 1
            fi
            ;;
            
        "licenses")
            local license_issues=$(jq -r '[.Results[]?.Licenses[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length' "${results_file}" 2>/dev/null || echo "0")
            
            echo -e "${BLUE}📄 License Summary:${NC}"
            echo -e "   License issues: ${license_issues}"
            
            if [[ "${license_issues}" -gt 0 ]]; then
                echo -e "${YELLOW}⚠️ License issues found${NC}"
                jq -r '.Results[]?.Licenses[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL") | "  - \(.Name): \(.Severity)"' "${results_file}" 2>/dev/null || echo "  - Error parsing license issues"
            fi
            ;;
            
        "configs")
            local config_issues=$(jq -r '[.Results[]?.Misconfigurations[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length' "${results_file}" 2>/dev/null || echo "0")
            
            echo -e "${BLUE}⚙️ Configuration Summary:${NC}"
            echo -e "   Configuration issues: ${config_issues}"
            
            if [[ "${config_issues}" -gt 0 ]]; then
                echo -e "${YELLOW}⚠️ Configuration issues found${NC}"
                jq -r '.Results[]?.Misconfigurations[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL") | "  - \(.ID): \(.Title)"' "${results_file}" 2>/dev/null || echo "  - Error parsing configuration issues"
            fi
            ;;
    esac
    
    return 0
}

# Parse all results
overall_status=0

echo -e "\n${BLUE}📈 Scan Results Summary${NC}"
echo "================================"

for scan_type in vulnerabilities secrets licenses configs; do
    if ! parse_results "${scan_type}"; then
        overall_status=1
    fi
    echo
done

# Generate human-readable report
cat > "${OUTPUT_DIR}/security-report.md" <<EOF
# Container Security Scan Report

**Scan Date:** $(date -u)
**Environment:** ${ENVIRONMENT}
**Image:** ${IMAGE_NAME}
**Scanner:** Trivy $(trivy --version | head -n1 | cut -d' ' -f2)

## Executive Summary

This report contains the results of a comprehensive security scan of the container image, including:
- Vulnerability assessment
- Secret detection
- License compliance
- Configuration analysis

## Scan Results

### Vulnerabilities
$(jq -r 'if (.Results[]?.Vulnerabilities | length) > 0 then "Found \(.Results[]?.Vulnerabilities | length) vulnerabilities" else "No vulnerabilities detected" end' "${OUTPUT_DIR}/vulnerabilities.json" 2>/dev/null || echo "Scan results unavailable")

### Secrets
$(jq -r 'if (.Results[]?.Secrets | length) > 0 then "⚠️ Found \(.Results[]?.Secrets | length) secrets" else "✅ No secrets detected" end' "${OUTPUT_DIR}/secrets.json" 2>/dev/null || echo "Scan results unavailable")

### Licenses
$(jq -r 'if (.Results[]?.Licenses | length) > 0 then "Found \(.Results[]?.Licenses | length) license entries" else "No license information available" end' "${OUTPUT_DIR}/licenses.json" 2>/dev/null || echo "Scan results unavailable")

### Configuration
$(jq -r 'if (.Results[]?.Misconfigurations | length) > 0 then "Found \(.Results[]?.Misconfigurations | length) configuration issues" else "No configuration issues detected" end' "${OUTPUT_DIR}/configs.json" 2>/dev/null || echo "Scan results unavailable")

## Recommendations

1. Address all CRITICAL and HIGH severity vulnerabilities
2. Remove any detected secrets from the image
3. Review license compliance requirements
4. Fix configuration security issues
5. Implement regular security scanning in CI/CD pipeline

---
*Report generated on $(date -u) by Trivy Security Scanner*
EOF

# Final status
if [[ ${overall_status} -eq 0 ]]; then
    echo -e "${GREEN}🎉 Security scan completed successfully - no critical issues found!${NC}"
else
    echo -e "${RED}⚠️ Security scan completed with critical issues that must be addressed${NC}"
fi

echo -e "${BLUE}📁 Scan results saved to: ${OUTPUT_DIR}${NC}"
exit ${overall_status}