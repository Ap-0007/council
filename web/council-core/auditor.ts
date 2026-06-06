import * as dotenv from 'dotenv';
import { callOllama } from './ollama';
import { AuditResult } from './types';

dotenv.config();

const MODEL_AUDIT = process.env.MODEL_AUDIT || 'qwen2.5';

const SYSTEM_PROMPT = `You are a strict hallucination and contradiction detector for an AI advisory system.
Your job is to audit a council member's response against the original decision text.

You check for three things:
1. UNSUPPORTED CLAIMS: facts, figures, or events not mentioned in the original decision text.
2. INTERNAL CONTRADICTIONS: statements within the response that conflict with each other.
3. OVERCONFIDENT SPECULATION: claims presented as fact when they are clearly inferences.

You MUST respond ONLY in valid JSON matching this exact schema:
{
  "hallucinationRisk": "<one of: LOW, MEDIUM, HIGH>",
  "flags": ["<each unsupported or contradictory claim as a brief string>"],
  "cleanedResponse": "<the original response text with unsupported claims replaced by [UNVERIFIED: <original claim>] and contradictions noted with [CONTRADICTION DETECTED]>",
  "internalConsistency": "<one sentence assessing whether the response is internally consistent>"
}

Rules:
- If flags is empty, hallucinationRisk MUST be LOW.
- If 1-2 flags, hallucinationRisk is MEDIUM.
- If 3+ flags, hallucinationRisk is HIGH.
- NEVER add new claims to cleanedResponse — only mark existing ones.
- Preserve all JSON structure and markdown in cleanedResponse.`;

export async function auditResponse(decision: string, memberName: string, response: string): Promise<AuditResult> {
  try {
    const userPrompt = `ORIGINAL DECISION TEXT:\n${decision}\n\nMEMBER: ${memberName}\nRESPONSE TO AUDIT:\n${response}`;
    const auditText = await callOllama(
      SYSTEM_PROMPT,
      userPrompt,
      MODEL_AUDIT,
      { temperature: 0.05, top_p: 0.4, num_predict: 600 },
      'json'
    );

    const result = JSON.parse(auditText);
    return {
      hallucinationRisk: ['LOW', 'MEDIUM', 'HIGH'].includes(result.hallucinationRisk)
        ? result.hallucinationRisk
        : 'UNKNOWN',
      flags: Array.isArray(result.flags) ? result.flags : [],
      cleanedResponse: result.cleanedResponse || response
    };
  } catch (e: any) {
    if (e.message === 'OLLAMA_CONNECTION' || e.message === 'OLLAMA_MODEL') throw e;
    return {
      hallucinationRisk: 'UNKNOWN',
      flags: [],
      cleanedResponse: response
    };
  }
}
