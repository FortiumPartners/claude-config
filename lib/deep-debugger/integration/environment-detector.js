/**
 * Environment Detector Module (TRD-005 - COMPLETE)
 *
 * Detects OS, runtime versions, frameworks, and dependencies
 * Supports 5 major frameworks: Node.js, Python, Ruby, .NET, Elixir
 *
 * @module lib/deep-debugger/integration/environment-detector
 */

async function detectEnvironment(options = {}) {
  const { projectPath, description } = options;
  const environment = {};

  try {
    const os = await detectOS({ description });
    if (os && Object.keys(os).length > 0) {
      environment.os = os.platform || os;
      if (os.version) environment.osVersion = os.version;
      if (os.arch) environment.arch = os.arch;
    }
  } catch (err) { /* ignore */ }

  try {
    const runtime = await detectRuntime({ description });
    if (runtime && runtime.name) {
      environment.runtime = (runtime.name + ' ' + (runtime.version || '')).trim();
    }
  } catch (err) { /* ignore */ }

  try {
    const framework = await detectFramework({ description });
    if (framework && framework.name) {
      environment.framework = (framework.name + ' ' + (framework.version || '')).trim();
    }
  } catch (err) { /* ignore */ }

  if (projectPath) {
    try {
      const deps = await parseDependencies(projectPath);
      if (deps && Object.keys(deps).length > 0) {
        environment.dependencies = deps;
      }
    } catch (err) { /* ignore */ }
  }

  return environment;
}

function detectOS(options = {}) {
  const { description } = options;

  // Synchronous when parsing from description
  if (description) {
    const osFromDesc = parseOSFromDescription(description);
    if (osFromDesc) {
      return osFromDesc;
    }
  }

  // Async when detecting current OS
  const os = require('os');
  return Promise.resolve({
    platform: os.platform(),
    version: os.release(),
    arch: os.arch()
  });
}

function parseOSFromDescription(description) {
  const osPatterns = [
    { regex: /macOS\s+([\d.]+)/i, platform: 'macOS' },
    { regex: /Windows\s+([\d.]+|11|10|8|7)/i, platform: 'Windows' },
    { regex: /Ubuntu\s+([\d.]+)/i, platform: 'Ubuntu' },
    { regex: /Linux Mint/i, platform: 'Linux Mint' },
    { regex: /Linux/i, platform: 'Linux' }
  ];

  for (const { regex, platform } of osPatterns) {
    const match = description.match(regex);
    if (match) {
      return { platform, version: match[1] || undefined };
    }
  }
  return null;
}

function detectRuntime(options = {}) {
  const { framework, description } = options;

  // Synchronous when parsing from description
  if (description) {
    const runtimeFromDesc = parseRuntimeFromDescription(description);
    if (runtimeFromDesc) {
      return runtimeFromDesc;
    }
  }

  // Async when detecting installed runtime
  if (framework) {
    const exec = require('child_process').execSync;
    try {
      switch (framework.toLowerCase()) {
        case 'node':
          const nodeVersion = exec('node --version', { encoding: 'utf8' }).trim().replace('v', '');
          return Promise.resolve({ name: 'Node.js', version: nodeVersion });
        case 'python':
          const pythonVersion = exec('python --version', { encoding: 'utf8' }).trim().split(' ')[1];
          return Promise.resolve({ name: 'Python', version: pythonVersion });
        case 'ruby':
          const rubyVersion = exec('ruby --version', { encoding: 'utf8' }).trim().match(/ruby\s+([\d.]+)/)?.[1];
          return Promise.resolve({ name: 'Ruby', version: rubyVersion });
        case 'dotnet':
          const dotnetVersion = exec('dotnet --version', { encoding: 'utf8' }).trim();
          return Promise.resolve({ name: '.NET', version: dotnetVersion });
        case 'elixir':
          const elixirVersion = exec('elixir --version', { encoding: 'utf8' }).trim().match(/Elixir\s+([\d.]+)/)?.[1];
          return Promise.resolve({ name: 'Elixir', version: elixirVersion });
        default:
          return Promise.resolve({ error: 'Runtime not installed or unsupported' });
      }
    } catch (err) {
      return Promise.resolve({ error: 'Runtime not installed or unsupported' });
    }
  }

  return Promise.resolve({});
}

function parseRuntimeFromDescription(description) {
  const runtimePatterns = [
    { regex: /Node\.?js\s+([\d.]+)/i, name: 'Node.js' },
    { regex: /Python\s+([\d.]+)/i, name: 'Python' },
    { regex: /Ruby\s+([\d.]+)/i, name: 'Ruby' },
    { regex: /\.NET\s+([\d.]+)/i, name: '.NET' },
    { regex: /Elixir\s+([\d.]+)/i, name: 'Elixir' }
  ];

  for (const { regex, name } of runtimePatterns) {
    const match = description.match(regex);
    if (match) {
      return { name, version: match[1] };
    }
  }
  return null;
}

function detectFramework(options = {}) {
  const { packageJsonContent, gemfileLockContent, csprojContent, mixExsContent, description, multiple } = options;
  const frameworks = [];

  // Synchronous when parsing from description
  if (description) {
    const frameworkFromDesc = parseFrameworkFromDescription(description);
    if (frameworkFromDesc) {
      return multiple ? [frameworkFromDesc] : frameworkFromDesc;
    }
  }

  if (packageJsonContent) {
    try {
      const pkg = JSON.parse(packageJsonContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['react'] || deps['react-dom']) {
        frameworks.push({ name: 'React', version: cleanVersion(deps['react'] || deps['react-dom']) });
      }
      if (deps['@nestjs/core'] || deps['@nestjs/common']) {
        frameworks.push({ name: 'NestJS', version: cleanVersion(deps['@nestjs/core'] || deps['@nestjs/common']) });
      }
      if (deps['express']) {
        frameworks.push({ name: 'Express', version: cleanVersion(deps['express']) });
      }
    } catch (err) { /* ignore */ }
  }

  if (gemfileLockContent) {
    const railsMatch = gemfileLockContent.match(/rails\s+\(([\d.]+)\)/);
    if (railsMatch) {
      frameworks.push({ name: 'Rails', version: railsMatch[1] });
    }
  }

  if (csprojContent) {
    if (csprojContent.includes('BlazorWebAssembly') || csprojContent.includes('Blazor')) {
      const targetFrameworkMatch = csprojContent.match(/<TargetFramework>(net[\d.]+)<\/TargetFramework>/);
      frameworks.push({ name: 'Blazor', version: targetFrameworkMatch ? targetFrameworkMatch[1] : undefined });
    }
  }

  if (mixExsContent) {
    const phoenixMatch = mixExsContent.match(/{:phoenix,\s*"~>\s*([\d.]+)"/);
    if (phoenixMatch) {
      frameworks.push({ name: 'Phoenix', version: phoenixMatch[1] });
    }
    const phoenixLiveViewMatch = mixExsContent.match(/{:phoenix_live_view,\s*"~>\s*([\d.]+)"/);
    if (phoenixLiveViewMatch) {
      frameworks.push({ name: 'Phoenix LiveView', version: phoenixLiveViewMatch[1] });
    }
  }

  if (frameworks.length === 0) {
    return multiple ? [] : {};
  }
  return multiple ? frameworks : frameworks[0];
}

function parseFrameworkFromDescription(description) {
  const frameworkPatterns = [
    { regex: /React\s+([\d.]+)/i, name: 'React' },
    { regex: /Rails\s+([\d.]+)/i, name: 'Rails' },
    { regex: /NestJS/i, name: 'NestJS' },
    { regex: /Blazor/i, name: 'Blazor' },
    { regex: /Phoenix\s+LiveView/i, name: 'Phoenix LiveView' },
    { regex: /Phoenix\s+([\d.]+)/i, name: 'Phoenix' }
  ];

  for (const { regex, name } of frameworkPatterns) {
    const match = description.match(regex);
    if (match) {
      return { name, version: match[1] || undefined };
    }
  }
  return null;
}

async function parseDependencies(filename, content) {
  if (!content) return {};

  try {
    if (filename.endsWith('package.json')) return parsePackageJson(content);
    else if (filename.endsWith('requirements.txt')) return parseRequirementsTxt(content);
    else if (filename === 'Gemfile') return parseGemfile(content);
    else if (filename.endsWith('.csproj')) return parseCsproj(content);
    else if (filename === 'mix.exs') return parseMixExs(content);
  } catch (err) {
    return {};
  }
  return {};
}

function parsePackageJson(content) {
  try {
    const pkg = JSON.parse(content);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    const cleaned = {};
    for (const [name, version] of Object.entries(allDeps)) {
      cleaned[name] = cleanVersion(version);
    }
    return cleaned;
  } catch (err) {
    return {};
  }
}

function parseRequirementsTxt(content) {
  const deps = {};
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.trim().startsWith('#') || !line.trim()) continue;
    const match = line.match(/^([a-zA-Z0-9_-]+)([=<>~]+)([\d.a-zA-Z]+)/);
    if (match) {
      const [, name, , version] = match;
      deps[name] = cleanVersion(version);
    }
  }
  return deps;
}

function parseGemfile(content) {
  const deps = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/gem\s+['"]([^'"]+)['"]\s*,?\s*['"]?([~>=<\d.\s]+)?['"]?/);
    if (match) {
      const [, name, version] = match;
      deps[name] = version ? cleanVersion(version.trim()) : undefined;
    }
  }
  return deps;
}

function parseCsproj(content) {
  const deps = {};
  const packageRefs = content.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g);
  for (const match of packageRefs) {
    const [, name, version] = match;
    deps[name] = version;
  }

  const targetFrameworkMatch = content.match(/<TargetFramework>([\w.]+)<\/TargetFramework>/);
  if (targetFrameworkMatch) {
    deps._targetFramework = targetFrameworkMatch[1];
  }
  return deps;
}

function parseMixExs(content) {
  const deps = {};

  // Extract dependencies from mix.exs deps function
  const depsMatch = content.match(/defp\s+deps\s+do\s*\[([\s\S]*?)\]/);
  if (!depsMatch) return deps;

  const depsContent = depsMatch[1];
  const depLines = depsContent.match(/{:[a-zA-Z0-9_]+,\s*"[^"]+"/g) || [];

  for (const line of depLines) {
    const match = line.match(/{:([a-zA-Z0-9_]+),\s*"~>\s*([\d.]+)"/);
    if (match) {
      const [, name, version] = match;
      deps[name] = version;
    }
  }

  // Extract Elixir version from mix.exs
  const elixirMatch = content.match(/elixir:\s*"[~>]*\s*([\d.]+)"/);
  if (elixirMatch) {
    deps._elixir = elixirMatch[1];
  }

  return deps;
}

function cleanVersion(version) {
  if (typeof version !== 'string') return version;
  return version.replace(/^[^0-9a-zA-Z]+/, '');
}

module.exports = {
  detectEnvironment,
  detectOS,
  detectRuntime,
  detectFramework,
  parseDependencies,
  parsePackageJson,
  parseRequirementsTxt,
  parseGemfile,
  parseCsproj,
  parseMixExs
};
