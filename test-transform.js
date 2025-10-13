const { YamlParser } = require('./src/parsers/yaml-parser');
const { ClaudeTransformer } = require('./src/transformers/claude-transformer');
const { Logger } = require('./src/utils/logger');
const fs = require('fs').promises;

const logger = new Logger({ level: 'info' });
const parser = new YamlParser(logger);
const transformer = new ClaudeTransformer(logger);

async function transform(yamlPath, outputPath) {
  const data = await parser.parse(yamlPath);
  const markdown = await transformer.transformAgent(data);
  await fs.writeFile(outputPath, markdown, 'utf8');
  console.log('✅ Transformed to:', outputPath);
}

transform(process.argv[2], process.argv[3]);
