/**
 * SkillLoader Usage Examples
 *
 * This file demonstrates common usage patterns for the SkillLoader class.
 */

const SkillLoader = require('./skill-loader');

// Example 1: Basic skill loading
async function example1_basicLoading() {
  const loader = new SkillLoader({
    agentName: 'backend-developer',
    agentVersion: '3.0.0'
  });

  try {
    // Load NestJS skill (quick reference only)
    const skill = await loader.loadSkill('nestjs', 'quick');
    console.log('Loaded NestJS skill:');
    console.log('- Frontmatter:', skill.frontmatter);
    console.log('- Content length:', skill.content.length);
  } catch (error) {
    console.error('Failed to load skill:', error.message);
  }
}

// Example 2: Comprehensive skill loading with REFERENCE.md
async function example2_comprehensiveLoading() {
  const loader = new SkillLoader({
    agentName: 'frontend-developer',
    agentVersion: '3.0.0'
  });

  try {
    // Load React skill with comprehensive details
    const skill = await loader.loadSkill('react', 'comprehensive');
    console.log('Loaded React skill with REFERENCE.md');

    // Check cache stats
    const stats = loader.getCacheStats();
    console.log('Cache stats:', stats);
  } catch (error) {
    console.error('Failed to load skill:', error.message);
  }
}

// Example 3: Loading templates
async function example3_templates() {
  const loader = new SkillLoader({
    agentName: 'backend-developer',
    agentVersion: '3.0.0'
  });

  try {
    // Load NestJS controller template
    const template = await loader.loadTemplate('nestjs', 'controller.template.ts');
    console.log('Loaded controller template:', template.substring(0, 100) + '...');
  } catch (error) {
    console.error('Failed to load template:', error.message);
  }
}

// Example 4: Custom user prompt handler
async function example4_customPrompt() {
  // Custom prompt function for CLI integration
  function customPrompt(message, options) {
    console.log('\n' + message);
    if (options.length > 0) {
      options.forEach((opt, idx) => console.log(`  ${idx + 1}. ${opt}`));
    }
    // In real implementation, would use readline or inquirer
    return Promise.resolve(0); // Default to first option
  }

  const loader = new SkillLoader({
    agentName: 'backend-developer',
    agentVersion: '3.0.0',
    promptUser: customPrompt
  });

  try {
    // Attempt to load non-existent skill
    await loader.loadSkill('nonexistent', 'quick');
  } catch (error) {
    console.log('Handled gracefully:', error.message);
  }
}

// Example 5: Cache management
async function example5_cacheManagement() {
  const loader = new SkillLoader({
    agentName: 'backend-developer',
    agentVersion: '3.0.0'
  });

  // Load multiple skills
  await loader.loadSkill('nestjs', 'quick');
  await loader.loadSkill('phoenix', 'quick');

  // Check if skills are cached
  console.log('NestJS cached:', loader.isSkillCached('nestjs'));
  console.log('React cached:', loader.isSkillCached('react'));

  // Get cache statistics
  const stats = loader.getCacheStats();
  console.log('Total cached entries:', stats.totalEntries);
  console.log('Total cache size:', stats.totalSize, 'bytes');

  // Clear cache
  loader.clearCache();
  console.log('After clear - NestJS cached:', loader.isSkillCached('nestjs'));
}

// Example 6: Version compatibility checking
async function example6_versionCompatibility() {
  // Agent with old version
  const oldLoader = new SkillLoader({
    agentName: 'backend-developer',
    agentVersion: '2.0.0' // Too old for skills requiring >=3.0.0
  });

  try {
    await oldLoader.loadSkill('nestjs', 'quick');
  } catch (error) {
    console.log('Version compatibility error:', error.message);
  }

  // Agent with compatible version
  const newLoader = new SkillLoader({
    agentName: 'backend-developer',
    agentVersion: '3.1.0' // Compatible with >=3.0.0
  });

  try {
    const skill = await newLoader.loadSkill('nestjs', 'quick');
    console.log('Successfully loaded with compatible version');
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

// Run examples
if (require.main === module) {
  (async () => {
    console.log('=== Example 1: Basic Loading ===');
    await example1_basicLoading();

    console.log('\n=== Example 2: Comprehensive Loading ===');
    await example2_comprehensiveLoading();

    console.log('\n=== Example 3: Templates ===');
    await example3_templates();

    console.log('\n=== Example 4: Custom Prompt ===');
    await example4_customPrompt();

    console.log('\n=== Example 5: Cache Management ===');
    await example5_cacheManagement();

    console.log('\n=== Example 6: Version Compatibility ===');
    await example6_versionCompatibility();
  })().catch(console.error);
}

module.exports = {
  example1_basicLoading,
  example2_comprehensiveLoading,
  example3_templates,
  example4_customPrompt,
  example5_cacheManagement,
  example6_versionCompatibility
};
