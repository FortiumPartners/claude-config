#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { YamlParser } = require('../src/parsers/yaml-parser');
const { Logger } = require('../src/utils/logger');

async function validateAllYaml() {
  const logger = new Logger('VALIDATOR');
  const parser = new YamlParser(logger);
  
  const yamlDir = path.join(__dirname, '..', 'agents', 'yaml');
  const files = await fs.readdir(yamlDir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml'));
  
  console.log(`\n📋 Validating ${yamlFiles.length} YAML files...\n`);
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const file of yamlFiles.sort()) {
    const filePath = path.join(yamlDir, file);
    try {
      await parser.parse(filePath);
      console.log(`✅ ${file}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${file}`);
      console.log(`   Error: ${error.message}\n`);
      failed++;
      failures.push({ file, error: error.message });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`📊 Validation Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(80));
  
  if (failures.length > 0) {
    console.log('\n❌ Failed validations:');
    failures.forEach(f => {
      console.log(`\n${f.file}:`);
      console.log(`  ${f.error}`);
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

validateAllYaml().catch(console.error);
