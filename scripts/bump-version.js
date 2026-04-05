#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// Update version
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

packageJson.version = newVersion;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// Create git tag
execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
execSync(`git push origin v${newVersion}`, { stdio: 'inherit' });

console.log(`Version bumped to ${newVersion} and tagged`);