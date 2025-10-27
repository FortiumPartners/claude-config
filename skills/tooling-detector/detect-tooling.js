#!/usr/bin/env node

/**
 * Tooling Detection System
 *
 * Multi-signal detection algorithm for identifying infrastructure tooling usage.
 * Detects Helm, Kubernetes, Kustomize, ArgoCD, and other DevOps tools.
 *
 * @module detect-tooling
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

/**
 * Load detection patterns from tooling-patterns.json
 * @returns {Object} Detection patterns configuration
 */
function loadPatterns() {
  const patternsPath = path.join(__dirname, 'tooling-patterns.json');
  const patternsJson = fs.readFileSync(patternsPath, 'utf8');
  return JSON.parse(patternsJson);
}

/**
 * Search for pattern matches in file content
 * @param {string} content - File content to search
 * @param {string[]} patterns - Regex patterns to match
 * @returns {number} Number of pattern matches found
 */
function findPatternMatches(content, patterns) {
  let matches = 0;
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'gm');
    const found = content.match(regex);
    if (found) {
      matches += found.length;
    }
  }
  return matches;
}

/**
 * Check if specific files exist (supports glob patterns)
 * @param {string} projectPath - Root project directory
 * @param {string|string[]} files - File path or list of file paths to check (supports glob patterns)
 * @returns {Promise<boolean>} True if any files exist
 */
async function checkFiles(projectPath, files) {
  const fileList = Array.isArray(files) ? files : [files];
  for (const file of fileList) {
    // Check if this is a glob pattern
    if (file.includes('*') || file.includes('?') || file.includes('[')) {
      // Use glob to find files
      try {
        const matches = await new Promise((resolve, reject) => {
          const g = glob(file, {
            cwd: projectPath,
            ignore: ['**/node_modules/**', '**/.git/**', '**/vendor/**']
          });
          const results = [];
          g.on('match', (match) => results.push(match));
          g.on('end', () => resolve(results));
          g.on('error', reject);
        });
        if (matches.length > 0) {
          return true;
        }
      } catch (error) {
        // If glob fails, continue to next file
        continue;
      }
    } else {
      // Direct file path check
      const filePath = path.join(projectPath, file);
      if (fs.existsSync(filePath)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if specific directories exist
 * @param {string} projectPath - Root project directory
 * @param {string[]} directories - List of directory paths to check
 * @returns {boolean} True if any directories exist
 */
function checkDirectories(projectPath, directories) {
  for (const dir of directories) {
    const dirPath = path.join(projectPath, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      return true;
    }
  }
  return false;
}

/**
 * Analyze files matching pattern for tool-specific patterns
 * @param {string} projectPath - Root project directory
 * @param {string} filePattern - Glob pattern for files
 * @param {string[]} patterns - Tool-specific patterns to match
 * @returns {Promise<number>} Number of files with matches
 */
async function analyzeFiles(projectPath, filePattern, patterns) {
  let fileList;
  try {
    // glob 8.x returns a Glob object that requires event listeners
    fileList = await new Promise((resolve, reject) => {
      const g = glob(filePattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/vendor/**']
      });
      const results = [];
      g.on('match', (file) => results.push(file));
      g.on('end', () => resolve(results));
      g.on('error', reject);
    });
  } catch (error) {
    // If glob fails, return 0
    return 0;
  }

  let filesWithMatches = 0;
  for (const file of fileList) {
    const filePath = path.join(projectPath, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (findPatternMatches(content, patterns) > 0) {
        filesWithMatches++;
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return filesWithMatches;
}

/**
 * Analyze shell scripts for CLI usage
 * @param {string} projectPath - Root project directory
 * @param {string[]} patterns - Tool-specific CLI patterns
 * @returns {Promise<number>} Number of matches
 */
async function analyzeCliScripts(projectPath, patterns) {
  let fileList;
  try {
    // glob 8.x returns a Glob object that requires event listeners
    fileList = await new Promise((resolve, reject) => {
      const g = glob('**/*.sh', {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/.git/**']
      });
      const results = [];
      g.on('match', (file) => results.push(file));
      g.on('end', () => resolve(results));
      g.on('error', reject);
    });
  } catch (error) {
    return 0;
  }

  let totalMatches = 0;
  for (const file of fileList) {
    const filePath = path.join(projectPath, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      totalMatches += findPatternMatches(content, patterns);
    } catch (error) {
      continue;
    }
  }

  return totalMatches;
}

/**
 * Calculate confidence score for a tool
 * @param {Object} detectionSignals - Signal detection results
 * @param {Object} signalConfigs - Signal configuration with weights
 * @param {number} confidenceBoost - Additional boost for tool
 * @param {number} signalCount - Number of signals detected
 * @param {number} minimumSignalsForBoost - Minimum signals needed for boost
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(detectionSignals, signalConfigs, confidenceBoost, signalCount, minimumSignalsForBoost) {
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [signalType, detected] of Object.entries(detectionSignals)) {
    if (detected && signalConfigs[signalType]) {
      weightedScore += signalConfigs[signalType].weight;
    }
    if (signalConfigs[signalType]) {
      totalWeight += signalConfigs[signalType].weight;
    }
  }

  // Normalize to 0-1 range
  let confidence = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Apply multi-signal boost if threshold met
  if (signalCount >= minimumSignalsForBoost) {
    confidence = Math.min(1.0, confidence + confidenceBoost);
  }

  return confidence;
}

/**
 * Detect infrastructure tooling usage in project
 * @param {string} projectPath - Root project directory
 * @param {Object} options - Detection options
 * @param {string[]} options.tools - Specific tools to detect (helm|kubernetes|kustomize|argocd)
 * @param {number} options.minimumConfidence - Minimum confidence threshold (default: 0.7)
 * @returns {Promise<Object>} Detection results
 */
async function detectTooling(projectPath, options = {}) {
  const patterns = loadPatterns();
  const { tools, detection_rules } = patterns;
  const results = [];

  // Filter tools if specific tools requested
  const toolsToCheck = options.tools
    ? Object.keys(tools).filter(t => options.tools.includes(t))
    : Object.keys(tools);

  // Analyze each tool
  for (const toolKey of toolsToCheck) {
    const toolConfig = tools[toolKey];
    const signals = {};
    let signalCount = 0;

    // Check each detection signal
    for (const [signalType, signalConfig] of Object.entries(toolConfig.detection_signals)) {
      let detected = false;

      // File existence check (simple check, supports glob patterns)
      if (signalConfig.files) {
        detected = await checkFiles(projectPath, signalConfig.files);
      }
      // Directory existence check
      else if (signalConfig.directories) {
        detected = checkDirectories(projectPath, signalConfig.directories);
      }
      // File pattern analysis with content patterns (single pattern)
      else if (signalConfig.file_pattern && signalConfig.patterns) {
        const matches = await analyzeFiles(projectPath, signalConfig.file_pattern, signalConfig.patterns);
        detected = matches > 0;
      }
      // File pattern analysis with content patterns (multiple patterns)
      else if (signalConfig.file_patterns && signalConfig.patterns) {
        let totalMatches = 0;
        for (const filePattern of signalConfig.file_patterns) {
          const matches = await analyzeFiles(projectPath, filePattern, signalConfig.patterns);
          totalMatches += matches;
        }
        detected = totalMatches > 0;
      }

      signals[signalType] = detected;
      if (detected) signalCount++;
    }

    // Calculate confidence
    const confidence = calculateConfidence(
      signals,
      toolConfig.detection_signals,
      toolConfig.confidence_boost || 0,
      signalCount,
      detection_rules.minimum_signals_for_boost
    );

    results.push({
      tool: toolKey,
      name: toolConfig.name,
      description: toolConfig.description,
      confidence,
      signals,
      signal_count: signalCount
    });
  }

  // Sort by confidence
  results.sort((a, b) => b.confidence - a.confidence);

  // Get minimum confidence threshold
  const minimumConfidence = options.minimumConfidence || detection_rules.minimum_confidence;

  // Filter detected tools (confidence >= threshold)
  const detectedTools = results.filter(r => r.confidence >= minimumConfidence);

  return {
    detected: detectedTools.length > 0,
    tools: detectedTools,
    all_results: results,
    detection_summary: {
      total_analyzed: results.length,
      detected_count: detectedTools.length,
      minimum_confidence: minimumConfidence
    }
  };
}

/**
 * Detect specific tool (Helm or Kubernetes)
 * @param {string} projectPath - Root project directory
 * @param {string} toolName - Tool name (helm|kubernetes)
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Detection result for specific tool
 */
async function detectTool(projectPath, toolName, options = {}) {
  const result = await detectTooling(projectPath, {
    ...options,
    tools: [toolName.toLowerCase()]
  });

  if (result.tools.length > 0) {
    return {
      detected: true,
      tool: result.tools[0].tool,
      name: result.tools[0].name,
      confidence: result.tools[0].confidence,
      signals: result.tools[0].signals,
      signal_count: result.tools[0].signal_count
    };
  }

  // Return first result even if not detected
  const toolResult = result.all_results[0];
  return {
    detected: false,
    tool: toolResult.tool,
    name: toolResult.name,
    confidence: toolResult.confidence,
    signals: toolResult.signals,
    signal_count: toolResult.signal_count
  };
}

/**
 * CLI interface for tooling detection
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const projectPath = args[0] || process.cwd();
  const options = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--tools' && args[i + 1]) {
      options.tools = args[i + 1].split(',');
      i++;
    } else if (args[i] === '--min-confidence' && args[i + 1]) {
      options.minimumConfidence = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--tool' && args[i + 1]) {
      // Detect single tool
      const toolName = args[i + 1];
      try {
        const startTime = Date.now();
        const result = await detectTool(projectPath, toolName, options);
        const duration = Date.now() - startTime;

        console.log(JSON.stringify({
          ...result,
          performance: {
            detection_time_ms: duration
          }
        }, null, 2));

        process.exit(result.detected ? 0 : 1);
      } catch (error) {
        console.error(`Error detecting ${toolName}:`, error.message);
        process.exit(2);
      }
      return;
    }
  }

  try {
    const startTime = Date.now();
    const result = await detectTooling(projectPath, options);
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      ...result,
      performance: {
        detection_time_ms: duration
      }
    }, null, 2));

    process.exit(result.detected ? 0 : 1);
  } catch (error) {
    console.error('Error detecting tooling:', error.message);
    process.exit(2);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

module.exports = {
  detectTooling,
  detectTool,
  loadPatterns
};
