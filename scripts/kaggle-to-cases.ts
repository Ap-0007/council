import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import * as dotenv from 'dotenv';
import { callOllama } from '../src/ollama.js';

dotenv.config();

const MODEL = process.env.MODEL_CLASSIFY || 'llama3';

async function convertRowToCase(row: any, category: string, index: number) {
  const cleanRow = Object.fromEntries(Object.entries(row).filter(([_, v]) => v));
  if (Object.keys(cleanRow).length === 0) return;

  const dataStr = Object.entries(cleanRow).map(([k, v]) => `${k}: ${v}`).join('\n');
  
  const systemPrompt = `You are converting raw data to a structured markdown case study.
Format EXACTLY with these sections:
## SITUATION
## KEY FACTS
## DECISION MADE
## OUTCOME
## LESSONS EXTRACTED

Never invent facts. Write INSUFFICIENT DATA if needed under a section.`;

  const userPrompt = `Convert this raw data into the case study format:\n\n${dataStr}`;

  try {
    const md = await callOllama(systemPrompt, userPrompt, 0.1, MODEL, 1500);
    if (!md.includes('## SITUATION')) {
      console.log(`Skipping case-${index} because it is missing ## SITUATION`);
      return;
    }
    const dir = `./knowledge/${category}`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(path.join(dir, `case-${index}.md`), md);
    console.log(`Generated case-${index}.md for ${category}`);
  } catch (e) {
    console.error(`Failed to generate case-${index}`, e);
  }
}

export async function processCSV(csvPath: string, category: string, maxRows: number = 50) {
  const file = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(file, { header: true, skipEmptyLines: true });
  
  let data = parsed.data;
  if (data.length > maxRows) {
    // sample evenly
    const step = data.length / maxRows;
    const sampled = [];
    for (let i = 0; i < maxRows; i++) {
      sampled.push(data[Math.floor(i * step)]);
    }
    data = sampled;
  }

  for (let i = 0; i < data.length; i++) {
    await convertRowToCase(data[i], category, i);
    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/kaggle-to-cases.ts <csvPath> <category> [maxRows]');
    process.exit(1);
  }
  
  const [csvPath, category, maxRowsStr] = args;
  const maxRows = maxRowsStr ? parseInt(maxRowsStr, 10) : 50;
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  await processCSV(csvPath, category, maxRows);
}

// Ignore top-level await errors in TS
if (process.argv[1].includes('kaggle-to-cases')) {
  main().catch(console.error);
}
