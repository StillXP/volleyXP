/**
 * figma-sync.ts
 *
 * Fetches local variables from a Figma file using the REST API v1 and writes
 * the result to src/tokens/base.json in style-dictionary v4 (W3C DTCG) format.
 *
 * Usage:
 *   npm run figma:sync
 *
 * Prerequisites:
 *   Copy .env.example to .env and fill in FIGMA_TOKEN and FIGMA_FILE_KEY.
 *   Requires Node 18+ for native fetch.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

type FigmaVariableValue = FigmaColor | number | string | boolean;

interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, FigmaVariableValue>;
}

interface FigmaVariableCollection {
  id: string;
  name: string;
  defaultModeId: string;
  modes: Array<{ modeId: string; name: string }>;
}

interface FigmaVariablesResponse {
  error?: boolean;
  status?: number;
  message?: string;
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaVariableCollection>;
  };
}

type TokenNode = {
  $value?: string | number;
  $type?: string;
  [key: string]: TokenNode | string | number | undefined;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Figma COLOR value (0–1 range) to a CSS hex or rgba string */
function figmaColorToHex(color: FigmaColor): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');

  if (color.a < 1) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = Math.round(color.a * 100) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/** Slugify a path segment to a valid token key */
function slugify(segment: string): string {
  return segment.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/** Deep-set a value at a nested path in an object */
function deepSet(obj: TokenNode, pathSegments: string[], leaf: TokenNode): void {
  let current = obj;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const key = pathSegments[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {} as TokenNode;
    }
    current = current[key] as TokenNode;
  }
  const lastKey = pathSegments[pathSegments.length - 1];
  current[lastKey] = leaf;
}

/** Recursively deep-merge two objects (b wins on conflict) */
function deepMerge(a: TokenNode, b: TokenNode): TokenNode {
  const result: TokenNode = { ...a };
  for (const key of Object.keys(b)) {
    const bVal = b[key];
    if (
      bVal !== null &&
      typeof bVal === 'object' &&
      !('$value' in (bVal as TokenNode))
    ) {
      result[key] = deepMerge((result[key] as TokenNode) ?? {}, bVal as TokenNode);
    } else {
      result[key] = bVal;
    }
  }
  return result;
}

/** Infer a style-dictionary $type from the variable's resolved type and name path */
function inferType(
  resolvedType: FigmaVariable['resolvedType'],
  namePath: string[]
): string {
  if (resolvedType === 'COLOR') return 'color';

  if (resolvedType === 'FLOAT') {
    const joined = namePath.join('/').toLowerCase();
    if (
      joined.includes('spacing') ||
      joined.includes('radius') ||
      joined.includes('size') ||
      joined.includes('width') ||
      joined.includes('height') ||
      joined.includes('border')
    ) {
      return 'dimension';
    }
    return 'number';
  }

  if (resolvedType === 'STRING') {
    const joined = namePath.join('/').toLowerCase();
    if (joined.includes('font')) return 'fontFamily';
    return 'other';
  }

  return 'other';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const FIGMA_TOKEN = process.env['FIGMA_TOKEN'];
  const FIGMA_FILE_KEY = process.env['FIGMA_FILE_KEY'];

  if (!FIGMA_TOKEN) {
    console.error(
      'Error: FIGMA_TOKEN is not set. Copy .env.example to .env and add your token.'
    );
    process.exit(1);
  }
  if (!FIGMA_FILE_KEY) {
    console.error(
      'Error: FIGMA_FILE_KEY is not set. Copy .env.example to .env and add your file key.'
    );
    process.exit(1);
  }

  const url = `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}/variables/local`;
  console.log(`Fetching variables from Figma file: ${FIGMA_FILE_KEY}`);

  const res = await fetch(url, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Figma API error ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = (await res.json()) as FigmaVariablesResponse;

  if (data.error) {
    console.error(`Figma API returned an error: ${data.message ?? 'unknown'}`);
    process.exit(1);
  }

  const { variables, variableCollections } = data.meta;

  let merged: TokenNode = {};
  let totalSynced = 0;
  const collectionNames: string[] = [];

  for (const collection of Object.values(variableCollections)) {
    collectionNames.push(collection.name);
    const defaultModeId = collection.defaultModeId;
    const collectionTokens: TokenNode = {};

    for (const variable of Object.values(variables)) {
      const value = variable.valuesByMode[defaultModeId];
      if (value === undefined) continue;
      if (variable.resolvedType === 'BOOLEAN') continue; // skip booleans

      // Parse the Figma variable name path (separator: '/')
      const rawPath = variable.name.split('/').map((s) => s.trim()).filter(Boolean);
      const namePath = rawPath.map(slugify);
      if (namePath.length === 0) continue;

      // Build the leaf token node
      const type = inferType(variable.resolvedType, rawPath);
      let tokenValue: string | number;

      if (variable.resolvedType === 'COLOR') {
        tokenValue = figmaColorToHex(value as FigmaColor);
      } else if (variable.resolvedType === 'FLOAT') {
        tokenValue = value as number;
      } else {
        tokenValue = String(value);
      }

      const leaf: TokenNode = {
        $value: tokenValue,
        $type: type,
      };

      deepSet(collectionTokens, namePath, leaf);
      totalSynced++;
    }

    merged = deepMerge(merged, collectionTokens);
  }

  const outputPath = path.join(process.cwd(), 'src', 'tokens', 'base.json');
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2) + '\n');

  console.log(
    `Synced ${totalSynced} variables from ${collectionNames.length} collection(s) [${collectionNames.join(', ')}]`
  );
  console.log(`→ ${outputPath}`);
  console.log('\nRun `npm run build:tokens` to regenerate SCSS variables.');
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
