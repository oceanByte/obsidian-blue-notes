#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import * as readline from 'readline';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  console.error('Please set your OpenAI API key:');
  console.error('  export OPENAI_API_KEY=sk-...');
  console.error('\nFalling back to standard changeset...');
  execSync('pnpm changeset', { stdio: 'inherit' });
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function getGitDiff() {
  try {
    // Try to get diff against main branch
    const diff = execSync('git diff main...HEAD', { encoding: 'utf-8' });
    if (diff.trim()) {
      return diff;
    }
  } catch (e) {
    // If that fails, try staged changes
  }

  try {
    const diff = execSync('git diff --staged', { encoding: 'utf-8' });
    if (diff.trim()) {
      return diff;
    }
  } catch (e) {
    // Ignore
  }

  // Fall back to unstaged changes
  try {
    const diff = execSync('git diff', { encoding: 'utf-8' });
    return diff;
  } catch (e) {
    return '';
  }
}

async function callOpenAI(diff) {
  const prompt = `Analyze these code changes and generate a changeset description for an Obsidian plugin release.

The changes:
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

Based on these changes, provide:
1. The semantic version bump type (patch/minor/major)
2. A concise, user-facing description of what changed (1-2 sentences)

Consider:
- patch: Bug fixes, minor tweaks, dependency updates
- minor: New features, improvements
- major: Breaking changes, major rewrites

Respond in this exact JSON format:
{
  "type": "patch|minor|major",
  "description": "Brief user-facing description of the change"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes code changes and generates semantic version changelogs.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  // Try to parse JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error('Failed to parse OpenAI response');
}

function generateChangesetId() {
  return Math.random().toString(36).substring(2, 15);
}

function createChangesetFile(type, description) {
  const id = generateChangesetId();
  const content = `---
"blue-notes": ${type}
---

${description}
`;

  const filename = `.changeset/${id}.md`;
  writeFileSync(filename, content);
  return filename;
}

async function main() {
  console.log('🤖 AI-powered changeset generation\n');

  // Get git diff
  console.log('📝 Analyzing changes...');
  const diff = await getGitDiff();

  if (!diff.trim()) {
    console.error('❌ No changes detected');
    console.error('Make some changes or stage them first.');
    process.exit(1);
  }

  // Call OpenAI
  console.log('🧠 Asking AI to analyze changes...');
  let result;
  try {
    result = await callOpenAI(diff);
  } catch (error) {
    console.error('❌ Failed to get AI response:', error.message);
    console.error('\nFalling back to standard changeset...');
    execSync('pnpm changeset', { stdio: 'inherit' });
    process.exit(0);
  }

  console.log('\n📊 AI Analysis:');
  console.log(`   Type: ${result.type}`);
  console.log(`   Description: ${result.description}\n`);

  // Ask for confirmation
  const choice = await prompt('Accept (a), Edit (e), Regenerate (r), or Cancel (c)? ');

  if (choice.toLowerCase() === 'c') {
    console.log('Cancelled.');
    rl.close();
    process.exit(0);
  }

  if (choice.toLowerCase() === 'r') {
    console.log('Regenerating...\n');
    rl.close();
    // Re-run the script
    execSync('node scripts/changeset-ai.mjs', { stdio: 'inherit' });
    process.exit(0);
  }

  let finalDescription = result.description;
  let finalType = result.type;

  if (choice.toLowerCase() === 'e') {
    const newType = await prompt(`Change type (current: ${result.type}): `);
    if (newType.trim()) {
      finalType = newType.trim();
    }
    const newDesc = await prompt(`Change description (current: ${result.description}): `);
    if (newDesc.trim()) {
      finalDescription = newDesc.trim();
    }
  }

  // Create changeset file
  const filename = createChangesetFile(finalType, finalDescription);
  console.log(`\n✅ Created changeset: ${filename}`);
  console.log('Don\'t forget to commit this file with your changes!');

  rl.close();
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
