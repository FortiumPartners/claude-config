/**
 * Custom Jest Environment for Node.js 25+ localStorage compatibility
 */
const NodeEnvironment = require('jest-environment-node').TestEnvironment;
const { LocalStorage } = require('node-localstorage');
const path = require('path');
const fs = require('fs');

class CustomEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);

    // Create temp directory for local storage
    const localStoragePath = path.join(process.cwd(), '.tmp', 'localStorage');
    if (!fs.existsSync(localStoragePath)) {
      fs.mkdirSync(localStoragePath, { recursive: true });
    }

    // Set up localStorage before any tests run
    this.global.localStorage = new LocalStorage(localStoragePath);
  }

  async setup() {
    await super.setup();
  }

  async teardown() {
    await super.teardown();
  }
}

module.exports = CustomEnvironment;
