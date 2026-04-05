#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🚀 Starting deployment process...');

// Run checks
console.log('✅ Running pre-deployment checks...');
execSync('npm run check', { stdio: 'inherit' });

// Build frontend
console.log('🔨 Building frontend...');
execSync('npm run build', { cwd: 'frontend', stdio: 'inherit' });

// Run tests
console.log('🧪 Running tests...');
execSync('npm test', { cwd: 'backend', stdio: 'inherit' });

console.log('🎉 Deployment checks passed! Ready to deploy.');