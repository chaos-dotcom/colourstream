#!/usr/bin/env node

/**
 * NPM Audit Report Generator
 * 
 * This script generates comprehensive security reports for all npm packages in the project.
 * It runs npm audit on the root, frontend, and backend packages and generates HTML and 
 * Markdown reports with vulnerability details.
 * 
 * Usage:
 *   node scripts/npm-audit-report.js
 * 
 * Requirements:
 *   - npm-audit-html (install globally with: npm install -g npm-audit-html)
 *   - fs-extra (install with: npm install fs-extra)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

// Configuration
const outputDir = path.join(__dirname, '..', 'security-reports');
const packages = [
  { name: 'root', path: path.join(__dirname, '..') },
  { name: 'frontend', path: path.join(__dirname, '..', 'frontend') },
  { name: 'backend', path: path.join(__dirname, '..', 'backend') }
];

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🔍 Starting NPM security audit for all packages...');

// Run audit for each package
const results = [];
packages.forEach(pkg => {
  const jsonOutput = path.join(outputDir, `npm-audit-${pkg.name}.json`);
  const htmlOutput = path.join(outputDir, `npm-audit-${pkg.name}.html`);
  const markdownOutput = path.join(outputDir, `npm-audit-${pkg.name}.md`);
  
  console.log(`\n📦 Auditing ${pkg.name} package...`);
  
  try {
    // Run npm audit and capture output directly using Node.js
    console.log(`   Running npm audit in ${pkg.path}`);
    let auditOutput;
    try {
      // Capture the output directly instead of redirecting to file
      auditOutput = execSync(`cd "${pkg.path}" && npm audit --json`, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Write output to file
      fs.writeFileSync(jsonOutput, auditOutput);
    } catch (cmdError) {
      // npm audit exits with non-zero if vulnerabilities are found
      // We still want to capture that output
      if (cmdError.stdout) {
        auditOutput = cmdError.stdout.toString();
        fs.writeFileSync(jsonOutput, auditOutput);
      } else {
        throw new Error(`Failed to get JSON output: ${cmdError.message}`);
      }
    }
    
    // Generate HTML report
    console.log(`   Generating HTML report`);
    execSync(`npm-audit-html -i "${jsonOutput}" -o "${htmlOutput}"`, { stdio: 'inherit' });
    
    // Parse JSON and create markdown summary
    let auditData;
    try {
      auditData = JSON.parse(fs.readFileSync(jsonOutput, 'utf8'));
    } catch (jsonError) {
      console.error(`   ⚠️ Error parsing JSON: ${jsonError.message}`);
      // Create minimal audit data if parsing fails
      auditData = { 
        metadata: { 
          vulnerabilities: { info: '?', low: '?', moderate: '?', high: '?', critical: '?' } 
        }
      };
      
      // Write the raw output to a text file for debugging
      fs.writeFileSync(`${jsonOutput}.raw`, auditOutput || 'No output captured');
    }
    
    const vulnData = auditData.metadata?.vulnerabilities || { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
    
    // Create markdown report
    console.log(`   Creating markdown summary`);
    let markdown = `# NPM Audit Report: ${pkg.name}\n\n`;
    markdown += `Report generated on: ${new Date().toISOString()}\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `- Info: ${vulnData.info || 0}\n`;
    markdown += `- Low: ${vulnData.low || 0}\n`;
    markdown += `- Moderate: ${vulnData.moderate || 0}\n`;
    markdown += `- High: ${vulnData.high || 0}\n`;
    markdown += `- Critical: ${vulnData.critical || 0}\n\n`;
    
    // Add vulnerability details if they exist
    if (auditData.vulnerabilities) {
      markdown += `## Vulnerabilities\n\n`;
      
      Object.entries(auditData.vulnerabilities).forEach(([name, vuln]) => {
        markdown += `### ${name}\n\n`;
        markdown += `- Severity: ${vuln.severity}\n`;
        markdown += `- Version: ${vuln.version}\n`;
        
        if (vuln.via) {
          markdown += `- Via:\n`;
          if (Array.isArray(vuln.via)) {
            vuln.via.forEach(v => {
              if (typeof v === 'string') {
                markdown += `  - ${v}\n`;
              } else {
                markdown += `  - ${v.name} (${v.severity}): ${v.title || v.url || ''}\n`;
              }
            });
          } else {
            markdown += `  - ${vuln.via}\n`;
          }
        }
        
        if (vuln.effects && vuln.effects.length > 0) {
          markdown += `- Effects: ${vuln.effects.join(', ')}\n`;
        }
        
        if (vuln.fixAvailable) {
          if (vuln.fixAvailable === false) {
            markdown += `- Fix: No fix available\n`;
          } else if (typeof vuln.fixAvailable === 'object') {
            markdown += `- Fix: ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}\n`;
          } else {
            markdown += `- Fix: ${vuln.fixAvailable}\n`;
          }
        }
        
        markdown += '\n';
      });
    }
    
    fs.writeFileSync(markdownOutput, markdown);
    
    // Store results for summary
    results.push({
      name: pkg.name,
      vulnerabilities: vulnData,
      reportPath: {
        json: jsonOutput,
        html: htmlOutput,
        markdown: markdownOutput
      }
    });
    
    console.log(`   ✅ Audit complete for ${pkg.name}`);
  } catch (error) {
    console.error(`   ❌ Error auditing ${pkg.name}:`, error.message);
    results.push({
      name: pkg.name,
      error: error.message
    });
  }
});

// Generate combined summary report
console.log('\n📊 Generating summary report...');
const summaryPath = path.join(outputDir, 'npm-audit-summary.md');
let summary = `# NPM Audit Summary Report\n\n`;
summary += `Report generated on: ${new Date().toLocaleString()}\n\n`;

// Calculate total vulnerabilities
const totalVulnerabilities = results.reduce((acc, result) => {
  if (result.vulnerabilities) {
    acc.info += result.vulnerabilities.info || 0;
    acc.low += result.vulnerabilities.low || 0;
    acc.moderate += result.vulnerabilities.moderate || 0;
    acc.high += result.vulnerabilities.high || 0;
    acc.critical += result.vulnerabilities.critical || 0;
  }
  return acc;
}, { info: 0, low: 0, moderate: 0, high: 0, critical: 0 });

// Add total vulnerabilities to summary
summary += `## Total Vulnerabilities\n\n`;
summary += `- Info: ${totalVulnerabilities.info}\n`;
summary += `- Low: ${totalVulnerabilities.low}\n`;
summary += `- Moderate: ${totalVulnerabilities.moderate}\n`;
summary += `- High: ${totalVulnerabilities.high}\n`;
summary += `- Critical: ${totalVulnerabilities.critical}\n\n`;

// Add per-package summaries
summary += `## Package Summaries\n\n`;
results.forEach(result => {
  summary += `### ${result.name}\n\n`;
  
  if (result.error) {
    summary += `❌ Error: ${result.error}\n\n`;
  } else if (result.vulnerabilities) {
    summary += `- Info: ${result.vulnerabilities.info || 0}\n`;
    summary += `- Low: ${result.vulnerabilities.low || 0}\n`;
    summary += `- Moderate: ${result.vulnerabilities.moderate || 0}\n`;
    summary += `- High: ${result.vulnerabilities.high || 0}\n`;
    summary += `- Critical: ${result.vulnerabilities.critical || 0}\n\n`;
    summary += `Reports:\n`;
    summary += `- [HTML Report](${path.relative(outputDir, result.reportPath.html)})\n`;
    summary += `- [Markdown Report](${path.relative(outputDir, result.reportPath.markdown)})\n`;
    summary += `- [JSON Data](${path.relative(outputDir, result.reportPath.json)})\n\n`;
  }
});

fs.writeFileSync(summaryPath, summary);

// Create an index.html file for easier navigation
const indexPath = path.join(outputDir, 'index.html');
let indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NPM Audit Reports</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .summary { margin-bottom: 30px; }
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    .summary-table th { background-color: #f2f2f2; }
    .critical { color: #d00; }
    .high { color: #f50; }
    .moderate { color: #f80; }
    .low { color: #88d; }
    .report-links { margin-bottom: 40px; }
    .report-links h2 { margin-bottom: 10px; }
    .report-links a { display: inline-block; margin-right: 15px; text-decoration: none; color: #0366d6; }
    .report-links a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>NPM Audit Security Reports</h1>
  <p>Generated on: ${new Date().toLocaleString()}</p>
  
  <div class="summary">
    <h2>Vulnerability Summary</h2>
    <table class="summary-table">
      <tr>
        <th>Package</th>
        <th>Critical</th>
        <th>High</th>
        <th>Moderate</th>
        <th>Low</th>
        <th>Info</th>
      </tr>
      <tr>
        <td><strong>Total</strong></td>
        <td class="critical">${totalVulnerabilities.critical}</td>
        <td class="high">${totalVulnerabilities.high}</td>
        <td class="moderate">${totalVulnerabilities.moderate}</td>
        <td class="low">${totalVulnerabilities.low}</td>
        <td>${totalVulnerabilities.info}</td>
      </tr>`;

results.forEach(result => {
  if (result.vulnerabilities) {
    indexHtml += `
      <tr>
        <td>${result.name}</td>
        <td class="critical">${result.vulnerabilities.critical || 0}</td>
        <td class="high">${result.vulnerabilities.high || 0}</td>
        <td class="moderate">${result.vulnerabilities.moderate || 0}</td>
        <td class="low">${result.vulnerabilities.low || 0}</td>
        <td>${result.vulnerabilities.info || 0}</td>
      </tr>`;
  } else {
    indexHtml += `
      <tr>
        <td>${result.name}</td>
        <td colspan="5">Error: ${result.error || 'No data available'}</td>
      </tr>`;
  }
});

indexHtml += `
    </table>
  </div>
  
  <div class="report-links">`;

results.forEach(result => {
  if (!result.error && result.reportPath) {
    indexHtml += `
    <div class="report-group">
      <h2>${result.name} Package</h2>
      <a href="${path.basename(result.reportPath.html)}" target="_blank">HTML Report</a>
      <a href="${path.basename(result.reportPath.markdown)}" target="_blank">Markdown Report</a>
      <a href="${path.basename(result.reportPath.json)}" target="_blank">JSON Data</a>
    </div>`;
  }
});

indexHtml += `
    <div class="report-group">
      <h2>Summary</h2>
      <a href="${path.basename(summaryPath)}" target="_blank">Summary Report</a>
    </div>
  </div>
  
  <script>
    // Highlight rows with vulnerabilities
    document.querySelectorAll('.summary-table tr').forEach(row => {
      const criticalCell = row.querySelector('td.critical');
      const highCell = row.querySelector('td.high');
      
      if (criticalCell && parseInt(criticalCell.textContent) > 0) {
        row.style.backgroundColor = '#fff0f0';
      } else if (highCell && parseInt(highCell.textContent) > 0) {
        row.style.backgroundColor = '#fff8f0';
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(indexPath, indexHtml);

console.log('\n✅ Security audit complete!');
console.log(`\nReports generated in: ${outputDir}`);
console.log(`Summary report: ${summaryPath}`);
console.log(`Interactive dashboard: ${indexPath}`);
console.log('\nOpen the interactive dashboard in your browser to view the results.'); 