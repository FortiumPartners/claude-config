/**
 * Environment Detector Tests (TRD-005)
 *
 * RED Phase: Write failing tests for environment detection
 *
 * Test Coverage:
 * - OS detection (macOS, Linux, Windows)
 * - Runtime version detection (Node.js, Python, Ruby, .NET, Elixir)
 * - Framework detection (React, Rails, NestJS, Blazor, Phoenix, etc.)
 * - Dependency parsing (package.json, requirements.txt, Gemfile, *.csproj, mix.exs)
 */

const {
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
} = require('../../integration/environment-detector');

describe('Environment Detector (TRD-005)', () => {
  describe('detectEnvironment', () => {
    it('should detect complete environment from project directory', async () => {
      const projectPath = '/Users/test/projects/sample-app';

      const environment = await detectEnvironment({ projectPath });

      // At minimum, should detect OS (runtime/framework/dependencies optional based on project)
      expect(environment).toHaveProperty('os');
      expect(typeof environment).toBe('object');
    });

    it('should detect environment from bug report description', async () => {
      const description = `
Bug occurs on macOS 14.0 with Node.js 18.16.0.
Using React 18.2.0 and Express 4.18.2.
      `;

      const environment = await detectEnvironment({ description });

      expect(environment.os).toContain('macOS');
      expect(environment.runtime).toContain('Node.js');
      expect(environment.framework).toContain('React');
    });

    it('should handle missing project path gracefully', async () => {
      const environment = await detectEnvironment({});

      expect(environment).toBeDefined();
      expect(typeof environment).toBe('object');
    });
  });

  describe('detectOS', () => {
    it('should detect macOS', async () => {
      const os = await detectOS();

      // Mock environment should return OS info
      expect(os).toHaveProperty('platform');
      expect(os).toHaveProperty('version');
    });

    it('should include OS architecture', async () => {
      const os = await detectOS();

      expect(os).toHaveProperty('arch');
      expect(['x64', 'arm64', 'x86']).toContain(os.arch);
    });

    it('should detect OS from description text', () => {
      const descriptions = [
        { text: 'Bug on macOS 14.0', expected: 'macOS' },
        { text: 'Windows 11 error', expected: 'Windows' },
        { text: 'Ubuntu 22.04 issue', expected: 'Ubuntu' },
        { text: 'Linux Mint problem', expected: 'Linux' }
      ];

      descriptions.forEach(({ text, expected }) => {
        const os = detectOS({ description: text });
        expect(os.platform).toContain(expected);
      });
    });
  });

  describe('detectRuntime', () => {
    it('should detect Node.js version', async () => {
      const runtime = await detectRuntime({ framework: 'node' });

      expect(runtime).toHaveProperty('name', 'Node.js');
      expect(runtime).toHaveProperty('version');
      expect(runtime.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should detect Python version', async () => {
      const runtime = await detectRuntime({ framework: 'python' });

      // Python may not be installed, check for either success or error
      if (runtime.error) {
        expect(runtime).toHaveProperty('error');
      } else {
        expect(runtime).toHaveProperty('name', 'Python');
        expect(runtime).toHaveProperty('version');
      }
    });

    it('should detect Ruby version', async () => {
      const runtime = await detectRuntime({ framework: 'ruby' });

      expect(runtime).toHaveProperty('name', 'Ruby');
      expect(runtime).toHaveProperty('version');
    });

    it('should detect .NET version', async () => {
      const runtime = await detectRuntime({ framework: 'dotnet' });

      expect(runtime).toHaveProperty('name', '.NET');
      expect(runtime).toHaveProperty('version');
    });

    it('should detect Elixir version', async () => {
      const runtime = await detectRuntime({ framework: 'elixir' });

      // Test will pass if Elixir is installed, or return error if not
      if (runtime.error) {
        expect(runtime).toHaveProperty('error');
      } else {
        expect(runtime).toHaveProperty('name');
      }
    });

    it('should handle runtime not installed', async () => {
      const runtime = await detectRuntime({ framework: 'haskell' });

      expect(runtime.error).toBeDefined();
    });

    it('should detect runtime from description', () => {
      const descriptions = [
        { text: 'Node.js 18.16.0 error', expected: { name: 'Node.js', version: '18.16.0' } },
        { text: 'Python 3.11.2 issue', expected: { name: 'Python', version: '3.11.2' } },
        { text: 'Ruby 3.2.0 problem', expected: { name: 'Ruby', version: '3.2.0' } },
        { text: '.NET 7.0 failure', expected: { name: '.NET', version: '7.0' } },
        { text: 'Elixir 1.15.4 bug', expected: { name: 'Elixir', version: '1.15.4' } }
      ];

      descriptions.forEach(({ text, expected }) => {
        const runtime = detectRuntime({ description: text });
        expect(runtime.name).toBe(expected.name);
        expect(runtime.version).toBe(expected.version);
      });
    });
  });

  describe('detectFramework', () => {
    it('should detect React from package.json', async () => {
      const packageJsonPath = '/test/package.json';
      const packageJsonContent = JSON.stringify({
        dependencies: { 'react': '^18.2.0', 'react-dom': '^18.2.0' }
      });

      const framework = await detectFramework({ packageJsonPath, packageJsonContent });

      expect(framework.name).toBe('React');
      expect(framework.version).toBe('18.2.0');
    });

    it('should detect Rails from Gemfile.lock', async () => {
      const gemfileLockPath = '/test/Gemfile.lock';
      const gemfileLockContent = `
    rails (7.0.4)
      actioncable (= 7.0.4)
      `;

      const framework = await detectFramework({ gemfileLockPath, gemfileLockContent });

      expect(framework.name).toBe('Rails');
      expect(framework.version).toBe('7.0.4');
    });

    it('should detect NestJS from package.json', async () => {
      const packageJsonContent = JSON.stringify({
        dependencies: { '@nestjs/core': '^10.0.0', '@nestjs/common': '^10.0.0' }
      });

      const framework = await detectFramework({ packageJsonContent });

      expect(framework.name).toBe('NestJS');
      expect(framework.version).toBe('10.0.0');
    });

    it('should detect Blazor from csproj file', async () => {
      const csprojPath = '/test/App.csproj';
      const csprojContent = `
<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">
  <PropertyGroup>
    <TargetFramework>net7.0</TargetFramework>
  </PropertyGroup>
</Project>
      `;

      const framework = await detectFramework({ csprojPath, csprojContent });

      expect(framework.name).toBe('Blazor');
      expect(framework.version).toContain('7.0');
    });

    it('should detect Phoenix from mix.exs', async () => {
      const mixExsContent = `
defmodule MyApp.MixProject do
  use Mix.Project

  def project do
    [
      app: :my_app,
      version: "0.1.0",
      elixir: "~> 1.15",
      deps: deps()
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7.10"},
      {:phoenix_live_view, "~> 0.20.1"}
    ]
  end
end
      `;

      const frameworks = await detectFramework({ mixExsContent, multiple: true });

      expect(Array.isArray(frameworks)).toBe(true);
      expect(frameworks.some(f => f.name === 'Phoenix')).toBe(true);
      expect(frameworks.some(f => f.name === 'Phoenix LiveView')).toBe(true);
    });

    it('should handle multiple frameworks', async () => {
      const packageJsonContent = JSON.stringify({
        dependencies: { 
          'react': '^18.2.0',
          'express': '^4.18.2'
        }
      });

      const frameworks = await detectFramework({ packageJsonContent, multiple: true });

      expect(Array.isArray(frameworks)).toBe(true);
      expect(frameworks.length).toBeGreaterThanOrEqual(2);
      expect(frameworks.some(f => f.name === 'React')).toBe(true);
      expect(frameworks.some(f => f.name === 'Express')).toBe(true);
    });

    it('should detect framework from description', () => {
      const descriptions = [
        { text: 'React 18.2.0 rendering issue', expected: 'React' },
        { text: 'Rails 7.0 ActiveRecord error', expected: 'Rails' },
        { text: 'NestJS API failure', expected: 'NestJS' },
        { text: 'Blazor component problem', expected: 'Blazor' }
      ];

      descriptions.forEach(({ text, expected }) => {
        const framework = detectFramework({ description: text });
        expect(framework.name).toBe(expected);
      });
    });
  });

  describe('parseDependencies', () => {
    it('should parse package.json dependencies', async () => {
      const content = JSON.stringify({
        dependencies: {
          'express': '^4.18.2',
          'react': '18.2.0',
          'lodash': '~4.17.21'
        },
        devDependencies: {
          'jest': '^29.5.0'
        }
      });

      const deps = await parseDependencies('package.json', content);

      expect(deps.express).toBe('4.18.2');
      expect(deps.react).toBe('18.2.0');
      expect(deps.lodash).toBe('4.17.21');
      expect(deps.jest).toBe('29.5.0');
    });

    it('should parse requirements.txt', async () => {
      const content = `
Django==4.2.0
pytest>=7.3.0
requests~=2.28.0
      `.trim();

      const deps = await parseDependencies('requirements.txt', content);

      expect(deps.Django).toBe('4.2.0');
      expect(deps.pytest).toBe('7.3.0');
      expect(deps.requests).toBe('2.28.0');
    });

    it('should parse Gemfile', async () => {
      const content = `
source 'https://rubygems.org'

gem 'rails', '~> 7.0.4'
gem 'pg', '>= 1.4.0'
gem 'puma'
      `.trim();

      const deps = await parseDependencies('Gemfile', content);

      expect(deps.rails).toBe('7.0.4');
      expect(deps.pg).toBe('1.4.0');
    });

    it('should parse csproj file', async () => {
      const content = `
<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore" Version="7.0.0" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
</Project>
      `;

      const deps = await parseDependencies('project.csproj', content);

      expect(deps['Microsoft.AspNetCore']).toBe('7.0.0');
      expect(deps['Newtonsoft.Json']).toBe('13.0.3');
    });

    it('should handle malformed dependency files', async () => {
      const content = 'invalid json {{{';

      const deps = await parseDependencies('package.json', content);

      expect(deps).toEqual({});
    });
  });

  describe('parsePackageJson', () => {
    it('should extract all dependencies', () => {
      const content = {
        dependencies: { 'express': '^4.18.2' },
        devDependencies: { 'jest': '^29.5.0' },
        peerDependencies: { 'react': '>=18.0.0' }
      };

      const deps = parsePackageJson(JSON.stringify(content));

      expect(deps.express).toBe('4.18.2');
      expect(deps.jest).toBe('29.5.0');
      expect(deps.react).toBe('18.0.0');
    });

    it('should clean version prefixes (^, ~, >=, etc.)', () => {
      const content = {
        dependencies: {
          'pkg1': '^1.0.0',
          'pkg2': '~2.0.0',
          'pkg3': '>=3.0.0',
          'pkg4': '4.0.0'
        }
      };

      const deps = parsePackageJson(JSON.stringify(content));

      expect(deps.pkg1).toBe('1.0.0');
      expect(deps.pkg2).toBe('2.0.0');
      expect(deps.pkg3).toBe('3.0.0');
      expect(deps.pkg4).toBe('4.0.0');
    });
  });

  describe('parseRequirementsTxt', () => {
    it('should parse Python requirements with various operators', () => {
      const content = `
Django==4.2.0
pytest>=7.3.0
requests~=2.28.0
flask<3.0.0
      `.trim();

      const deps = parseRequirementsTxt(content);

      expect(deps.Django).toBe('4.2.0');
      expect(deps.pytest).toBe('7.3.0');
      expect(deps.requests).toBe('2.28.0');
      expect(deps.flask).toBe('3.0.0');
    });

    it('should handle comments and empty lines', () => {
      const content = `
# Core dependencies
Django==4.2.0

# Testing
pytest>=7.3.0
      `.trim();

      const deps = parseRequirementsTxt(content);

      expect(deps.Django).toBe('4.2.0');
      expect(deps.pytest).toBe('7.3.0');
    });
  });

  describe('parseGemfile', () => {
    it('should parse Ruby gem dependencies', () => {
      const content = `
source 'https://rubygems.org'

gem 'rails', '~> 7.0.4'
gem 'pg', '>= 1.4.0'
gem 'puma'
      `.trim();

      const deps = parseGemfile(content);

      expect(deps.rails).toBe('7.0.4');
      expect(deps.pg).toBe('1.4.0');
    });

    it('should handle group blocks', () => {
      const content = `
gem 'rails', '7.0.4'
group :development, :test do
  gem 'rspec', '~> 3.12.0'
end
      `.trim();

      const deps = parseGemfile(content);

      expect(deps.rails).toBe('7.0.4');
      expect(deps.rspec).toBe('3.12.0');
    });
  });

  describe('parseCsproj', () => {
    it('should parse .NET package references', () => {
      const content = `
<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore" Version="7.0.0" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
</Project>
      `;

      const deps = parseCsproj(content);

      expect(deps['Microsoft.AspNetCore']).toBe('7.0.0');
      expect(deps['Newtonsoft.Json']).toBe('13.0.3');
    });

    it('should extract target framework', () => {
      const content = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net7.0</TargetFramework>
  </PropertyGroup>
</Project>
      `;

      const result = parseCsproj(content);

      expect(result._targetFramework).toBe('net7.0');
    });
  });

  describe('parseMixExs', () => {
    it('should parse Elixir mix.exs dependencies', () => {
      const content = `
defmodule MyApp.MixProject do
  use Mix.Project

  def project do
    [
      app: :my_app,
      version: "0.1.0",
      elixir: "~> 1.15",
      deps: deps()
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7.10"},
      {:phoenix_live_view, "~> 0.20.1"},
      {:ecto, "~> 3.10"},
      {:postgrex, "~> 0.17"}
    ]
  end
end
      `;

      const deps = parseMixExs(content);

      expect(deps.phoenix).toBe('1.7.10');
      expect(deps.phoenix_live_view).toBe('0.20.1');
      expect(deps.ecto).toBe('3.10');
      expect(deps.postgrex).toBe('0.17');
    });

    it('should extract Elixir version', () => {
      const content = `
defmodule MyApp.MixProject do
  def project do
    [
      elixir: "~> 1.15",
      deps: deps()
    ]
  end
end
      `;

      const deps = parseMixExs(content);

      expect(deps._elixir).toBe('1.15');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle beta and rc versions', () => {
      const content = JSON.stringify({
        dependencies: {
          'react': '19.0.0-rc.0',
          'next': '14.0.0-beta.1'
        }
      });

      const deps = parsePackageJson(content);

      expect(deps.react).toBe('19.0.0-rc.0');
      expect(deps.next).toBe('14.0.0-beta.1');
    });

    it('should handle nightly builds', () => {
      const content = `
pytest==8.0.0.dev123
      `.trim();

      const deps = parseRequirementsTxt(content);

      expect(deps.pytest).toBe('8.0.0.dev123');
    });

    it('should handle missing files gracefully', async () => {
      const environment = await detectEnvironment({ 
        projectPath: '/nonexistent/path' 
      });

      expect(environment).toBeDefined();
      expect(environment.error).toBeUndefined(); // Should not error, just return partial data
    });
  });
});
