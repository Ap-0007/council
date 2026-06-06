import * as dotenv from 'dotenv';
import { callOllama } from './ollama.js';
import { SynthesisResult, CouncilResponse } from './types.js';

dotenv.config();

const MODEL_SYNTHESIS = process.env.MODEL_SYNTHESIS || 'llama3.1';

// ─── CONSISTENCY CHECK PASS ──────────────────────────────────────────────────
// Before synthesising, scan for outright contradictions between members.
const CONSISTENCY_SYSTEM = `You are a logical consistency auditor for a council of advisors.
Scan all member perspectives for direct logical contradictions (not just different opinions — actual contradictions where Member A says X is true and Member B says X is false).

You MUST respond ONLY in valid JSON:
{
  "consistencyFlags": ["<describe each outright contradiction as a brief string — empty array if none found>"],
  "summary": "<one sentence on overall consistency level>"
}`;

const SYNTHESIS_SYSTEM = `You are The Council Synthesizer — the final voice that integrates five radically different perspectives into a single, actionable verdict.

Your job is NOT to average opinions. Find the emergent insight that only becomes visible when all perspectives are combined.
Weight perspectives by their confidence scores (higher confidence = more weight in the verdict).

You MUST respond ONLY in valid JSON matching this exact schema:
{
  "consensus": "<2-3 sentences summarising the genuine area of agreement across members>",
  "coreTension": "<the single sharpest unresolved contradiction between members — be specific>",
  "tradeoffs": ["<list 2-3 major tradeoffs associated with the verdict>"],
  "finalVerdict": "<3-4 sentences of concrete, integrated recommendation — actionable, not abstract>",
  "actionPlan": ["<Step 1>", "<Step 2>", "<Step 3>"],
  "confidenceScore": <weighted average of member confidence scores, integer 0-100>,
  "questionsToAnswer": ["<3 critical questions the user must answer before deciding>"]
}

Rules:
- finalVerdict MUST be actionable, not a summary of the debate.
- actionPlan MUST be concrete steps to execute the verdict.
- tradeoffs MUST be explicit sacrifices being made by choosing this path.
- Do NOT mention member names in the final verdict.
- If confidences are all low (<40), add a caveat about insufficient information.
- Output ONLY the JSON object. No preamble.`;

export async function synthesize(decision: string, responses: CouncilResponse[]): Promise<SynthesisResult> {
  // ── Step 1: Consistency check ──────────────────────────────────────────────
  let consistencyFlags: string[] = [];
  try {
    const consistencyPrompt = responses
      .filter(r => r.auditedResponse !== '[MEMBER UNAVAILABLE]')
      .map(r => `${r.memberName} (confidence ${r.confidence ?? '?'}%):\n${r.auditedResponse}`)
      .join('\n\n---\n\n');
    
    const consistencyRaw = await callOllama(
      CONSISTENCY_SYSTEM,
      `Decision: ${decision}\n\nPerspectives:\n${consistencyPrompt}`,
      MODEL_SYNTHESIS,
      { temperature: 0.05, top_p: 0.4, num_predict: 400 },
      'json'
    );
    const consistencyData = JSON.parse(consistencyRaw);
    consistencyFlags = Array.isArray(consistencyData.consistencyFlags)
      ? consistencyData.consistencyFlags
      : [];
  } catch {
    // Consistency check is non-blocking — continue without it
  }

  // ── Step 2: Build synthesis prompt with confidence weights ─────────────────
  const avgConfidence = responses.length > 0
    ? Math.round(responses.reduce((sum, r) => sum + (r.confidence ?? 50), 0) / responses.length)
    : 50;

  const memberSummaries = responses
    .filter(r => r.auditedResponse !== '[MEMBER UNAVAILABLE]')
    .map(r => `${r.memberName} (confidence: ${r.confidence ?? '?'}%, risk: ${r.hallucinationRisk}):\n${r.auditedResponse}`)
    .join('\n\n---\n\n');

  const consistencyContext = consistencyFlags.length > 0
    ? `\n\nCONSISTENCY FLAGS DETECTED:\n${consistencyFlags.map(f => `• ${f}`).join('\n')}\nAcknowledge these in coreTension.\n`
    : '';

  const userPrompt = `Decision: ${decision}${consistencyContext}\n\nMember Perspectives (weighted by confidence):\n${memberSummaries}`;

  let rawResponse = '';
  try {
    rawResponse = await callOllama(
      SYNTHESIS_SYSTEM,
      userPrompt,
      MODEL_SYNTHESIS,
      { temperature: 0.2, top_p: 0.6, num_predict: 900 },
      'json'
    );
    const result = parseSynthesis(rawResponse);
    return { ...result, consistencyFlags };
  } catch (e: any) {
    if (e.message === 'OLLAMA_CONNECTION' || e.message === 'OLLAMA_MODEL') throw e;
    // One retry
    try {
      rawResponse = await callOllama(
        SYNTHESIS_SYSTEM,
        userPrompt,
        MODEL_SYNTHESIS,
        { temperature: 0.2, top_p: 0.6, num_predict: 900 },
        'json'
      );
      const result = parseSynthesis(rawResponse);
      return { ...result, consistencyFlags };
    } catch (e2: any) {
      if (e2.message === 'OLLAMA_CONNECTION' || e2.message === 'OLLAMA_MODEL') throw e2;
      return { ...fallbackSynthesis(rawResponse || 'Synthesis failed.'), consistencyFlags };
    }
  }
}

function parseSynthesis(text: string): SynthesisResult {
  try {
    const data = JSON.parse(text);
    return {
      consensus: data.consensus || '',
      coreTension: data.coreTension || '',
      tradeoffs: Array.isArray(data.tradeoffs) ? data.tradeoffs : [],
      finalVerdict: data.finalVerdict || '',
      actionPlan: Array.isArray(data.actionPlan) ? data.actionPlan : [],
      confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 0,
      questionsToAnswer: Array.isArray(data.questionsToAnswer) ? data.questionsToAnswer : [],
      parseError: (!data.consensus || !data.finalVerdict)
    };
  } catch {
    return fallbackSynthesis(text);
  }
}

function fallbackSynthesis(rawResponse: string): SynthesisResult {
  return {
    consensus: '',
    coreTension: '',
    tradeoffs: [],
    finalVerdict: rawResponse,
    actionPlan: [],
    confidenceScore: 0,
    questionsToAnswer: [],
    parseError: true
  };
}
