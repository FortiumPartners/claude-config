#!/bin/bash
# Kubernetes Security Validation Script (kube-score)
# Task 3.1: Advanced security scanning and validation

set -euo pipefail

# Configuration
MANIFESTS_DIR="${1:-/manifests}"
OUTPUT_DIR="${2:-/output}"
ENVIRONMENT="${3:-development}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Starting Kubernetes security validation with kube-score${NC}"
echo "Environment: ${ENVIRONMENT}"
echo "Manifests directory: ${MANIFESTS_DIR}"
echo "Output directory: ${OUTPUT_DIR}"

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Function to run kube-score on a file
run_kube_score() {
    local file=$1
    local filename=$(basename "${file}")
    local output_file="${OUTPUT_DIR}/${filename}.json"
    
    echo -e "${BLUE}📋 Scanning ${filename}...${NC}"
    
    if kube-score score "${file}" \
        --output-format json \
        --output-version v2 \
        > "${output_file}" 2>&1; then
        echo -e "${GREEN}✅ ${filename} scan completed${NC}"
    else
        echo -e "${RED}❌ ${filename} scan failed${NC}"
        return 1
    fi
    
    # Parse results for immediate feedback
    local score=$(jq -r '.score // "N/A"' "${output_file}")
    local critical_issues=$(jq -r '[.checks[] | select(.grade == "CRITICAL")] | length' "${output_file}")
    local warnings=$(jq -r '[.checks[] | select(.grade == "WARNING")] | length' "${output_file}")
    
    echo -e "${BLUE}📊 Results for ${filename}:${NC}"
    echo -e "   Score: ${score}"
    echo -e "   Critical Issues: ${critical_issues}"
    echo -e "   Warnings: ${warnings}"
    
    if [[ "${critical_issues}" -gt 0 ]]; then
        echo -e "${RED}🚨 Critical security issues found in ${filename}${NC}"
        jq -r '.checks[] | select(.grade == "CRITICAL") | "  - \(.check): \(.comment)"' "${output_file}"
        return 1
    fi
}

# Find and scan all Kubernetes manifest files
total_files=0
failed_files=0

if [[ ! -d "${MANIFESTS_DIR}" ]]; then
    echo -e "${YELLOW}⚠️ Manifests directory not found: ${MANIFESTS_DIR}${NC}"
    exit 0
fi

while IFS= read -r -d '' file; do
    ((total_files++))
    if ! run_kube_score "${file}"; then
        ((failed_files++))
    fi
    echo # Add spacing between files
done < <(find "${MANIFESTS_DIR}" -type f \( -name "*.yaml" -o -name "*.yml" \) -print0)

# Generate consolidated report
echo -e "${BLUE}📊 Generating consolidated security report...${NC}"

cat > "${OUTPUT_DIR}/security-summary.json" <<EOF
{
  "scan_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "total_files_scanned": ${total_files},
  "files_with_issues": ${failed_files},
  "scan_success_rate": $(echo "scale=2; (${total_files} - ${failed_files}) * 100 / ${total_files}" | bc)
}
EOF

# Merge all individual results
jq -s 'map(select(. != null))' "${OUTPUT_DIR}"/*.json > "${OUTPUT_DIR}/complete-results.json" 2>/dev/null || echo "[]" > "${OUTPUT_DIR}/complete-results.json"

# Generate human-readable report
cat > "${OUTPUT_DIR}/security-report.md" <<EOF
# Kubernetes Security Validation Report

**Scan Date:** $(date -u)
**Environment:** ${ENVIRONMENT}
**Scanner:** kube-score

## Summary
- **Total Files Scanned:** ${total_files}
- **Files with Critical Issues:** ${failed_files}
- **Success Rate:** $(echo "scale=2; (${total_files} - ${failed_files}) * 100 / ${total_files}" | bc)%

## Detailed Results
EOF

# Add detailed results for each file
for result_file in "${OUTPUT_DIR}"/*.json; do
    if [[ $(basename "${result_file}") != "security-summary.json" ]] && [[ $(basename "${result_file}") != "complete-results.json" ]]; then
        local manifest_name=$(basename "${result_file}" .json)
        echo "### ${manifest_name}" >> "${OUTPUT_DIR}/security-report.md"
        jq -r '.checks[] | "- **\(.check)**: \(.comment) (Grade: \(.grade))"' "${result_file}" >> "${OUTPUT_DIR}/security-report.md" 2>/dev/null || echo "- No issues found" >> "${OUTPUT_DIR}/security-report.md"
        echo >> "${OUTPUT_DIR}/security-report.md"
    fi
done

# Final results
echo -e "${BLUE}📈 Security validation completed${NC}"
echo -e "Total files scanned: ${total_files}"
echo -e "Files with critical issues: ${failed_files}"

if [[ ${failed_files} -eq 0 ]]; then
    echo -e "${GREEN}🎉 All Kubernetes manifests passed security validation!${NC}"
    exit 0
else
    echo -e "${RED}⚠️ ${failed_files} file(s) have critical security issues that must be resolved${NC}"
    exit 1
fi