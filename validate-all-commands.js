const { YamlParser } = require('./src/parsers/yaml-parser');
const { Logger } = require('./src/utils/logger');
const fs = require('fs').promises;
const path = require('path');

const logger = new Logger({ level: 'info' });
const parser = new YamlParser(logger);

async function validateAll() {
  const yamlDir = path.join(__dirname, 'commands/yaml');
  const files = await fs.readdir(yamlDir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml'));
  
  console.log(`\n🔍 Validating ${yamlFiles.length} YAML commands...\n`);
  
  const results = {
    valid: [],
    invalid: []
  };
  
  for (const file of yamlFiles.sort()) {
    try {
      const data = await parser.parse(path.join(yamlDir, file));
      console.log(`✅ ${file.padEnd(35)} - ${data.metadata.name}`);
      results.valid.push({
        file,
        name: data.metadata.name,
        version: data.metadata.version,
        category: data.metadata.category
      });
    } catch (error) {
      console.log(`❌ ${file.padEnd(35)} - ERROR`);
      console.log(`   ${error.message.split('\n')[0]}`);
      results.invalid.push({ file, error: error.message });
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`\n📊 Validation Summary:`);
  console.log(`   ✅ Valid:   ${results.valid.length}`);
  console.log(`   ❌ Invalid: ${results.invalid.length}`);
  console.log(`   📁 Total:   ${yamlFiles.length}`);
  
  if (results.invalid.length > 0) {
    console.log(`\n❌ Failed Validations:\n`);
    results.invalid.forEach(({ file, error }) => {
      console.log(`   ${file}:`);
      console.log(`   ${error.split('\n').slice(0, 3).join('\n   ')}\n`);
    });
    process.exit(1);
  }
  
  console.log(`\n✅ All commands validated successfully!\n`);
  
  // Group by category
  const byCategory = results.valid.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});
  
  console.log('📋 Commands by Category:\n');
  Object.entries(byCategory).sort().forEach(([category, commands]) => {
    console.log(`   ${category.toUpperCase()} (${commands.length}):`);
    commands.forEach(c => console.log(`      - ${c.name}`));
    console.log('');
  });
}

validateAll().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
