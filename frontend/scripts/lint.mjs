import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function collectFiles(dir, exts = ['.js', '.jsx', '.css']) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

const FORBIDDEN_PATTERNS = [
  { regex: /\bbg-white\b/, label: 'bg-white' },
  { regex: /\bbg-gray-50\b/, label: 'bg-gray-50' },
  { regex: /\bbg-gray-100\b/, label: 'bg-gray-100' },
  { regex: /\btext-gray-900\b/, label: 'text-gray-900' },
  { regex: /\bborder-gray-200\b/, label: 'border-gray-200' },
  { regex: /\btext-white\b/, label: 'text-white' },
  { regex: /#fff\b/i, label: '#fff' },
  { regex: /#ffffff\b/i, label: '#ffffff' },
];

const FORBIDDEN_RECHARTS = ['BoxPlot', 'Histogram', 'Heatmap'];

async function runLint() {
  const files = collectFiles(srcDir);
  let errorCount = 0;

  for (const file of files) {
    const relPath = path.relative(path.resolve(__dirname, '..'), file);
    const content = fs.readFileSync(file, 'utf8');
    const ext = path.extname(file);

    // 1. Check for forbidden light-theme tokens
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.regex.test(content)) {
        console.error(`[LINT ERROR] ${relPath}: Found forbidden light-theme token "${pat.label}"`);
        errorCount++;
      }
    }

    // 2. Check JS/JSX syntax and Recharts imports
    if (ext === '.js' || ext === '.jsx') {
      try {
        await transformWithEsbuild(content, file, {
          loader: 'jsx',
          jsx: 'automatic',
        });
      } catch (err) {
        console.error(`[LINT ERROR] ${relPath}: Syntax / JSX transform error:\n${err.message}`);
        errorCount++;
      }

      const rechartsImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]recharts['"]/s);
      if (rechartsImportMatch) {
        const importedSpecifiers = rechartsImportMatch[1];
        for (const bad of FORBIDDEN_RECHARTS) {
          const importRegex = new RegExp(`\\b${bad}\\b`);
          if (importRegex.test(importedSpecifiers)) {
            console.error(`[LINT ERROR] ${relPath}: Forbidden Recharts import "${bad}"`);
            errorCount++;
          }
        }
      }
    }
  }

  if (errorCount > 0) {
    console.error(`\nLint failed with ${errorCount} error(s).`);
    process.exit(1);
  } else {
    console.log(`Lint passed: Checked ${files.length} source files with 0 errors.`);
  }
}

runLint();
