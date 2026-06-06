import { search } from 'duck-duck-scrape';
import { callOllama } from './ollama';

const MODEL_CLASSIFY = process.env.MODEL_CLASSIFY || 'llama3.2';

export async function generateSearchQueries(decision: string): Promise<string[]> {
  const systemPrompt = `You are an expert researcher. Your goal is to identify if the given decision relies on recent, verifiable real-world facts (e.g. stock prices, current events, software releases). 
If it does, generate 1-2 highly specific Google search queries to gather that context. 
If the decision is purely philosophical, personal, or hypothetical, return an empty array.
You MUST output ONLY a valid JSON array of strings. Do not output anything else.`;

  const userPrompt = `Decision:
${decision}

Return a JSON array of 0 to 2 search queries.`;

  try {
    const res = await callOllama(
      systemPrompt,
      userPrompt,
      MODEL_CLASSIFY,
      { temperature: 0.1, top_p: 0.5, num_predict: 100 },
      'json'
    );
    const queries = JSON.parse(res);
    if (Array.isArray(queries)) {
      return queries.map(q => String(q)).slice(0, 2);
    }
    return [];
  } catch (e) {
    console.warn('Search query generation failed:', e);
    return [];
  }
}

import { WebResearchResult } from './types.js';

export async function executeSearch(queries: string[]): Promise<{ formattedText: string; structuredData: WebResearchResult | null }> {
  if (queries.length === 0) return { formattedText: '', structuredData: null };
  
  let formattedText = '';
  const structuredData: WebResearchResult = { queries, results: [] };

  for (const query of queries) {
    try {
      const searchResult = await search(query);
      
      const topResults = searchResult.results.slice(0, 3);
      if (topResults.length > 0) {
        formattedText += `### SEARCH QUERY: "${query}"\n`;
        topResults.forEach(r => {
          formattedText += `- **${r.title}**: ${r.description}\n`;
          structuredData.results.push({
            query,
            title: r.title,
            url: r.url,
            description: r.description
          });
        });
        formattedText += '\n';
      }
    } catch (e) {
      console.warn(`Failed to execute search for ${query}:`, e);
    }
  }
  
  return { formattedText: formattedText.trim(), structuredData };
}
