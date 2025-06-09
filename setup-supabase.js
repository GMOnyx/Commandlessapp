#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n=== Supabase Setup for Commandless App ===\n');
console.log('This script will help you set up Supabase for your Commandless app.');
console.log('You\'ll need your Supabase URL and Anon Key from your Supabase project settings.');
console.log('You can find these at https://app.supabase.com under Project Settings > API\n');

let supabaseUrl = '';
let supabaseKey = '';

rl.question('Enter your Supabase URL: ', (url) => {
  supabaseUrl = url.trim();
  
  rl.question('Enter your Supabase Anon Key: ', (key) => {
    supabaseKey = key.trim();
    
    const envContent = `# Supabase Configuration
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseKey}
USE_SUPABASE=true

# Application Configuration
PORT=5001
`;

    try {
      fs.writeFileSync(path.join(__dirname, '.env'), envContent);
      console.log('\n✅ .env file created successfully with your Supabase credentials.');
      console.log('\nNext steps:');
      console.log('1. Run the SQL script in setup-database.sql in your Supabase SQL Editor');
      console.log('2. Start the app with npm run dev');
      console.log('\nFor more information, check the README.md file.\n');
    } catch (err) {
      console.error('\n❌ Error creating .env file:', err.message);
    }
    
    rl.close();
  });
});

rl.on('close', () => {
  console.log('\nSetup complete. Happy coding!\n');
}); 