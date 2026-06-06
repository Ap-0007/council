import fs from 'fs';
import path from 'path';
import { semanticRetrieve } from './embeddings';

function tokenize(text: string): string[] {
  const stopwords = new Set(['a', 'the', 'and', 'or', 'to', 'in', 'is', 'my', 'me', 'we', 'it', 'of', 'for', 'should', 'do', 'be', 'this', 'that', 'i']);
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 0 && !stopwords.has(w));
}

export function retrieveContext(decision: string, decisionType: string, topK: number = 2): string {
  const dirPath = require("path").resolve(__dirname, `../../knowledge/${decisionType}/`);
  if (!fs.existsSync(dirPath)) return '';

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  if (files.length === 0) return '';

  const tokens = tokenize(decision);
  
  const docs = files.map(file => {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    const contentLower = content.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      const regex = new RegExp(`\\b${token}\\b`, 'gi');
      const matches = contentLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    return { filename: file, content, score };
  });

  docs.sort((a, b) => b.score - a.score);
  const topDocs = docs.filter(d => d.score > 0).slice(0, topK);
  
  if (topDocs.length === 0) return '';
  
  return topDocs.map(doc => `### REFERENCE CASE: ${doc.filename}\n${doc.content}`).join('\n\n---\n\n');
}

export async function getContext(decision: string, decisionType: string): Promise<string> {
  const semanticCtx = await semanticRetrieve(decision, 2);
  if (semanticCtx) return semanticCtx;

  const keywordCtx = retrieveContext(decision, decisionType, 2);
  return keywordCtx || '';
}
