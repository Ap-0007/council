import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { DocIndex } from './types.js';

dotenv.config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_EMBED = process.env.MODEL_EMBED || 'nomic-embed-text';
const INDEX_PATH = './knowledge/.index.json';

export async function embed(text: string): Promise<number[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_EMBED,
        prompt: text
      })
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error('OLLAMA_MODEL');
      throw new Error('Failed to generate embedding');
    }
    const data = await res.json();
    return data.embedding;
  } catch (error: any) {
    if (error.message === 'OLLAMA_MODEL') throw error;
    if (error.cause?.code === 'ECONNREFUSED' || error.name === 'TypeError') {
      throw new Error('OLLAMA_CONNECTION');
    }
    throw error;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function walkDir(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else {
      if (file.endsWith('.md')) {
        results.push(file);
      }
    }
  });
  return results;
}

export async function buildIndex() {
  console.log('Building index...');
  const files = walkDir('./knowledge');
  const index: DocIndex[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const category = path.basename(path.dirname(file));
    const filename = path.basename(file);
    const textToEmbed = content.slice(0, 1200);
    try {
      const embedding = await embed(textToEmbed);
      index.push({ filename, category, content, embedding });
      console.log(`Embedded ${filename}`);
    } catch (e) {
      console.error(`Error embedding ${filename}`, e);
    }
  }

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`Index saved to ${INDEX_PATH}`);
}

export async function loadOrBuildIndex(): Promise<DocIndex[]> {
  if (fs.existsSync(INDEX_PATH)) {
    const data = fs.readFileSync(INDEX_PATH, 'utf8');
    return JSON.parse(data);
  }
  await buildIndex();
  const data = fs.readFileSync(INDEX_PATH, 'utf8');
  return JSON.parse(data);
}

export async function semanticRetrieve(decision: string, topK: number = 2): Promise<string> {
  try {
    const index = await loadOrBuildIndex();
    if (index.length === 0) return '';
    const decisionEmbedding = await embed(decision);
    
    const scoredDocs = index.map(doc => ({
      ...doc,
      score: cosineSimilarity(decisionEmbedding, doc.embedding)
    }));

    scoredDocs.sort((a, b) => b.score - a.score);
    const topDocs = scoredDocs.slice(0, topK);

    return topDocs.map(doc => `### REFERENCE CASE: ${doc.filename}\n${doc.content}`).join('\n\n---\n\n');
  } catch (e) {
    return '';
  }
}
