#!/usr/bin/env node

/**
 * Quick Test Runner for Commandless Bot System
 */

import { runComprehensiveTests } from './test-comprehensive-bot-types.js';

console.log('🚀 Starting Rapid Bot Testing...\n');

runComprehensiveTests()
  .then(() => {
    console.log('\n✅ All tests completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Testing failed:', error.message);
    process.exit(1);
  }); 