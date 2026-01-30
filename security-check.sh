#!/bin/bash

# Dependency Security Check Script
# Scans both frontend and backend dependencies for vulnerabilities

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Grover Dependency Security Check                       ║"
echo "╔════════════════════════════════════════════════════════════╗"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create reports directory
mkdir -p security-reports

echo -e "${YELLOW}[1/4] Checking Python dependencies...${NC}"
cd backend

if command -v safety &> /dev/null; then
    echo "Running safety check..."
    safety check --json > ../security-reports/python-vulnerabilities.json || true
    safety check > ../security-reports/python-vulnerabilities.txt || true
    echo -e "${GREEN}✓ Python security check complete${NC}"
else
    echo -e "${YELLOW}⚠ Safety not installed. Install with: pip install safety${NC}"
fi

if command -v bandit &> /dev/null; then
    echo "Running Bandit security scanner..."
    bandit -r . -f json -o ../security-reports/bandit-report.json || true
    bandit -r . > ../security-reports/bandit-report.txt || true
    echo -e "${GREEN}✓ Bandit scan complete${NC}"
else
    echo -e "${YELLOW}⚠ Bandit not installed. Install with: pip install bandit${NC}"
fi

cd ..

echo ""
echo -e "${YELLOW}[2/4] Checking Node.js dependencies...${NC}"
cd frontend

if command -v npm &> /dev/null; then
    echo "Running npm audit..."
    npm audit --json > ../security-reports/npm-audit.json || true
    npm audit > ../security-reports/npm-audit.txt || true
    echo -e "${GREEN}✓ npm audit complete${NC}"
    
    echo "Checking for outdated packages..."
    npm outdated --json > ../security-reports/npm-outdated.json || true
    npm outdated > ../security-reports/npm-outdated.txt || true
    echo -e "${GREEN}✓ Outdated packages check complete${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
fi

cd ..

echo ""
echo -e "${YELLOW}[3/4] Checking for common security issues...${NC}"

# Check for exposed secrets
echo "Scanning for potential secrets..."
if command -v grep &> /dev/null; then
    grep -r -i "password\|secret\|api_key\|token" --include="*.py" --include="*.ts" --include="*.tsx" \
        --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=venv \
        backend/ frontend/ > security-reports/potential-secrets.txt 2>/dev/null || true
    echo -e "${GREEN}✓ Secret scanning complete${NC}"
fi

# Check for TODO/FIXME comments
echo "Checking for TODO/FIXME markers..."
grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.py" --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=venv \
    backend/ frontend/ > security-reports/todos.txt 2>/dev/null || true
echo -e "${GREEN}✓ Code marker check complete${NC}"

echo ""
echo -e "${YELLOW}[4/4] Generating summary report...${NC}"

# Create summary report
cat > security-reports/SUMMARY.md << EOF
# Security & Dependency Report

Generated: $(date)

## Summary

This report contains security scans and dependency checks for the Grover application.

## Reports Generated

1. **Python Vulnerabilities**
   - \`python-vulnerabilities.json\` - Safety check results (JSON)
   - \`python-vulnerabilities.txt\` - Safety check results (readable)

2. **Python Security Issues**
   - \`bandit-report.json\` - Bandit scan results (JSON)
   - \`bandit-report.txt\` - Bandit scan results (readable)

3. **Node.js Vulnerabilities**
   - \`npm-audit.json\` - npm audit results (JSON)
   - \`npm-audit.txt\` - npm audit results (readable)

4. **Outdated Packages**
   - \`npm-outdated.json\` - Outdated npm packages (JSON)
   - \`npm-outdated.txt\` - Outdated npm packages (readable)

5. **Code Quality**
   - \`potential-secrets.txt\` - Potential hardcoded secrets
   - \`todos.txt\` - TODO/FIXME markers

## Recommendations

### High Priority
- Review and fix all HIGH and CRITICAL vulnerabilities
- Update outdated packages with known security issues
- Remove any hardcoded secrets or credentials

### Medium Priority
- Update packages that are more than 2 major versions behind
- Address MEDIUM severity vulnerabilities
- Review and resolve TODO/FIXME comments

### Low Priority
- Update all other outdated packages
- Address LOW severity issues
- Improve code documentation

## Next Steps

1. Review each report file in detail
2. Create tickets for high-priority security issues
3. Schedule dependency updates
4. Re-run this script after making changes

## Tools Used

- **safety**: Python dependency security scanner
- **bandit**: Python code security scanner
- **npm audit**: Node.js dependency security scanner
- **grep**: Text pattern matching for secrets and markers

EOF

echo -e "${GREEN}✓ Summary report generated${NC}"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Security Check Complete                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Reports saved to: security-reports/"
echo ""
echo "Quick Summary:"
echo "-------------"

# Count vulnerabilities if files exist
if [ -f "security-reports/python-vulnerabilities.txt" ]; then
    PYTHON_VULNS=$(grep -c "vulnerability found" security-reports/python-vulnerabilities.txt || echo "0")
    echo "Python vulnerabilities: $PYTHON_VULNS"
fi

if [ -f "security-reports/npm-audit.txt" ]; then
    echo "Node.js audit results available in npm-audit.txt"
fi

echo ""
echo "Review SUMMARY.md for detailed findings and recommendations."
