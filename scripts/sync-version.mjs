#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const version = packageJson.version;

console.log(`Syncing version ${version} to manifest.json and versions.json...`);

const manifestPath = join(rootDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
manifest.version = version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('✓ Updated manifest.json');

const versionsPath = join(rootDir, 'versions.json');
const versions = JSON.parse(readFileSync(versionsPath, 'utf-8'));
versions[version] = manifest.minAppVersion;
writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');
console.log('✓ Updated versions.json');

console.log('Version sync complete!');
