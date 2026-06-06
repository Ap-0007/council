import { nanoid } from 'nanoid';
import * as dotenv from 'dotenv';
import { members } from './members.js';
import { callOllama } from './ollama.js';
import { getContext } from './retriever.js';
import { auditResponse } from './auditor.js';
import { synthesize } from './synthesizer.js';
import { saveSession } from './session.js';
import { generateSearchQueries, executeSearch } from './search.js';
import { CouncilSession, CouncilResponse, FollowUp, ProgressEvent } from './types.js';

dotenv.config();

const MODEL_CLASSIFY = process.env.MODEL_CLASSIFY || 'qwen2.5';

// ─── SELF-CRITIQUE PROMPT ─────────────────────────────────────────────────────
// After the member produces their answer, we ask them to critique it.
const SELF_CRITIQUE_SYSTEM = `You are reviewing your own previous answer for logical errors, unsupported claims, and internal contradictions.
Be harsh. Identify specific problems.
You MUST respond ONLY in valid JSON:
{
  "issues": ["<one issue per string — empty array if none found>"],
  "severityScore": <integer 0-10 where 0=perfect, 10=critically flawed>
}`;

async function classifyDecision(decision: string): Promise<string> {
  try {
    const prompt = `Classify the following decision into EXACTLY ONE category from this list: career, financial, personal, strategic, ethical, technical.
Decision: ${decision}

You MUST respond ONLY in valid JSON:
{
  "classification": "strategic"
}`;
    const res = await callOllama(
      'You are a precise decision classifier. Output only valid JSON.',
      prompt,
      MODEL_CLASSIFY,
      { temperature: 0, top_p: 0.1, num_predict: 30 },
      'json'
    );
    const data = JSON.parse(res);
    const word = (data.classification || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const valid = ['career', 'financial', 'personal', 'strategic', 'ethical', 'technical'];
    return valid.includes(word) ? word : 'strategic';
  } catch (e: any) {
    if (e.message === 'OLLAMA_CONNECTION' || e.message === 'OLLAMA_MODEL') throw e;
    return 'strategic';
  }
}

// ─── SEVEN-STAGE DEEP REASONING PIPELINE ───────────────────────────────────
// Stage 1 — PARSE:               Extract explicit facts + identify gaps
// Stage 2 — STEELMAN:            Argue the strongest case AGAINST your own likely conclusion
// Stage 3 — PRESSURE TEST:       Does your original view survive the steelman attack?
// Stage 4 — PRE-MORTEM:          Imagine spectacular failure 12 months out. Why did it happen?
// Stage 5 — DRAFT SYNTHESIS:     Write a preliminary structured JSON answer
// Stage 6 — CROSS-EXAMINATION:   Review the draft, find flaws, contradictions, and weak points
// Stage 7 — REFINED SYNTHESIS:   Write the final JSON answer, explicitly fixing the cross-examination flaws

export interface ThinkingStage {
  id: string;
  label: string;
  content: string;
}

async function tryStage(member: any, stages: ThinkingStage[], id: string, label: string, systemPrompt: string, userPrompt: string, opts: any, format?: 'json'): Promise<string> {
  try {
    const result = await (await import('./ollama.js')).callOllama(systemPrompt, userPrompt, member.model, opts, format);
    stages.push({ id, label, content: result });
    return result;
  } catch (e: any) {
    if (e.message === 'OLLAMA_CONNECTION' || e.message === 'OLLAMA_MODEL') throw e;
    stages.push({ id, label, content: `[${label} unavailable]` });
    return `[${label} unavailable]`;
  }
}

async function getMemberDraft(
  member: any,
  userMessage: string
): Promise<{ draftResponse: string; stages: ThinkingStage[]; traces: string }> {
  const stages: ThinkingStage[] = [];
  
  const parseResult = await tryStage(member, stages, 'parse', 'PARSE',
    `You are ${member.name}. You are preparing to advise on a decision. Before anything else, do a rigorous fact inventory.`,
    `${userMessage}\n\nList facts, unknowns, assumptions. No JSON.`,
    { temperature: 0.15, top_p: 0.5, num_predict: 600 }
  );

  const principlesResult = await tryStage(member, stages, 'first_principles', 'FIRST PRINCIPLES',
    `You are ${member.name}. Strip this problem down to its fundamental, undeniable truths.`,
    `${userMessage}\n\nYour fact inventory:\n${parseResult}\n\nWhat are the absolute core truths here that cannot be violated? Reason up from there.`,
    { temperature: member.temperature, top_p: 0.7, num_predict: 400 }
  );

  const steelmanResult = await tryStage(member, stages, 'steelman', 'STEELMAN',
    `You are ${member.name}. Play devil's advocate against yourself.`,
    `${userMessage}\n\nYour core truths:\n${principlesResult}\n\nBuild the STRONGEST POSSIBLE ARGUMENT against your own initial direction.`,
    { temperature: member.temperature + 0.15, top_p: 0.85, num_predict: 500 }
  );

  const pressureTestResult = await tryStage(member, stages, 'pressure_test', 'PRESSURE TEST',
    `You are ${member.name}. Adjudicate between your original direction and the steelman.`,
    `${userMessage}\n\nSteelman:\n${steelmanResult}\n\nWhat lands? What can you rebut? What is your post-stress position?`,
    { temperature: member.temperature, top_p: member.topP ?? 0.7, num_predict: 500 }
  );

  const secondOrderResult = await tryStage(member, stages, 'second_order', 'SECOND-ORDER EFFECTS',
    `You are ${member.name}. Map out the unintended consequences.`,
    `${userMessage}\n\nIf we follow your post-stress position (${pressureTestResult}), what happens at 6 months? 1 year? 5 years? What breaks?`,
    { temperature: member.temperature + 0.1, top_p: 0.8, num_predict: 500 }
  );

  const premortemResult = await tryStage(member, stages, 'pre_mortem', 'PRE-MORTEM',
    `You are ${member.name}, conducting a pre-mortem analysis.`,
    `${userMessage}\n\nAssume the decision fails spectacularly in 12 months. Write the post-mortem from the future. Why did it fail?`,
    { temperature: member.temperature + 0.1, top_p: 0.8, num_predict: 500 }
  );

  const traces = `[PARSE]\n${parseResult}\n[FIRST PRINCIPLES]\n${principlesResult}\n[STEELMAN]\n${steelmanResult}\n[PRESSURE TEST]\n${pressureTestResult}\n[SECOND-ORDER EFFECTS]\n${secondOrderResult}\n[PRE-MORTEM]\n${premortemResult}`;

  const draftPrompt = `${userMessage}\n\n--- YOUR DEEP REASONING TRACE ---\n${traces}\n---\n\nNow write a preliminary structured JSON answer.`;

  const draftResponse = await tryStage(member, stages, 'draft', 'DRAFT SYNTHESIS',
    member.systemPrompt, draftPrompt,
    { temperature: member.temperature, top_p: member.topP, num_predict: 900 },
    'json'
  );

  return { draftResponse, stages, traces };
}

async function getMemberFinal(
  member: any,
  decision: string,
  userMessage: string,
  draftResponse: string,
  traces: string,
  stages: ThinkingStage[],
  peerDrafts: { name: string, draft: string }[]
): Promise<{ rawResponse: string; formattedResponse: string; confidence: number }> {
  
  let peerText = peerDrafts.map(p => `--- ${p.name}'s Draft ---\n${p.draft}`).join('\n\n');
  if (!peerText) peerText = "No peers available.";

  const peerReviewResult = await tryStage(member, stages, 'peer_review', 'PEER REVIEW',
    `You are ${member.name}. Read the drafts of your fellow council members and critique them.`,
    `Here is the decision:\n${decision}\n\nHere are the drafts of your peers:\n\n${peerText}\n\nWhat did they miss? Where is their logic flawed? How can you incorporate their best points into your own advice?`,
    { temperature: 0.2, top_p: 0.6, num_predict: 500 }
  );

  const crossExamineResult = await tryStage(member, stages, 'cross_examination', 'CROSS-EXAMINATION',
    `You are ${member.name}, reviewing your own drafted answer to find weaknesses.`,
    `Here is the original decision:\n${decision}\n\nHere is your drafted JSON answer:\n${draftResponse}\n\nCritique this draft ruthlessly.`,
    { temperature: 0.15, top_p: 0.5, num_predict: 600 }
  );

  const finalPrompt = `${userMessage}\n\n--- YOUR DEEP REASONING TRACE ---\n${traces}\n\n--- YOUR PEER REVIEW ---\n${peerReviewResult}\n\n--- YOUR CROSS-EXAMINATION OF YOUR DRAFT ---\n${crossExamineResult}\n\nRewrite your structured JSON answer. You MUST fix the specific flaws identified in your cross-examination and incorporate insights from your peer review.`;

  let finalRaw = await tryStage(member, stages, 'refined_synthesis', 'REFINED SYNTHESIS',
    member.systemPrompt, finalPrompt,
    { temperature: member.temperature, top_p: member.topP, num_predict: 900 },
    'json'
  );

  let formattedResponse = '';
  let confidence = 50;
  try {
    const parsed = JSON.parse(finalRaw);
    confidence = typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 50;
    for (const key of member.formatKeys) {
      if (key === 'confidence') continue;
      if (parsed[key]) {
        const label = key.replace(/_/g, ' ');
        formattedResponse += `**[${label}]**\n${parsed[key]}\n\n`;
      }
    }
  } catch {
    formattedResponse = finalRaw;
  }

  return { rawResponse: finalRaw, formattedResponse, confidence };
}

// ─── DYNAMIC MEMBER SELECTION ───────────────────────────────────────────────
async function selectMembersDynamic(decision: string, allMembers: any[]): Promise<string[]> {
  try {
    const roster = allMembers.map(m => `- ${m.id}: ${m.name} (${m.title})`).join('\n');
    const prompt = `You are the Council Orchestrator. The user has a decision to make.
You must select EXACTLY 3 experts from the roster to form the best possible council for this specific decision.
Decision: ${decision}

Roster:
${roster}

You MUST respond ONLY in valid JSON:
{
  "selectedIds": ["id1", "id2", "id3"]
}`;
    const res = await (await import('./ollama.js')).callOllama(
      'You are a precise orchestrator. Output only valid JSON.',
      prompt,
      process.env.MODEL_CLASSIFY || 'qwen2.5',
      { temperature: 0.1, top_p: 0.1, num_predict: 50 },
      'json'
    );
    const data = JSON.parse(res);
    const ids = Array.isArray(data.selectedIds) ? data.selectedIds : [];
    const validIds = ids.filter((id: string) => allMembers.some(m => m.id === id)).slice(0, 3);
    if (validIds.length === 3) return validIds;
    // fallback if it fails to pick exactly 3 valid ones
    return allMembers.slice(0, 3).map(m => m.id);
  } catch (e) {
    return allMembers.slice(0, 3).map(m => m.id);
  }
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────
export async function runCouncil(
  decision: string,
  selectedMemberIds: string[],
  onProgress?: (event: ProgressEvent) => void
): Promise<CouncilSession> {
  const sessionId = nanoid(8);
  const emit = (event: ProgressEvent) => { if (onProgress) onProgress(event); };

  let activeMembers = members.filter(m => selectedMemberIds.includes(m.id));

  // Dynamic Assembly
  if (selectedMemberIds.includes('dynamic')) {
    emit({ type: 'status', message: 'Orchestrator is selecting the best experts...' });
    const dynamicIds = await selectMembersDynamic(decision, members);
    activeMembers = members.filter(m => dynamicIds.includes(m.id));
  }

  emit({ type: 'status', message: 'Classifying decision type...' });
  const type = await classifyDecision(decision);

  emit({ type: 'status', message: 'Retrieving relevant context cases...' });
  const contextUsed = await getContext(decision, type);

  emit({ type: 'status', message: 'Searching the web for live context...' });
  const searchQueries = await generateSearchQueries(decision);
  const { formattedText, structuredData } = await executeSearch(searchQueries);

  if (structuredData && structuredData.results.length > 0) {
    emit({ type: 'web_research_done', webResearch: structuredData });
  }

  let userMessage = '';
  if (contextUsed) userMessage += `CONTEXT FROM SIMILAR CASES:\n${contextUsed}\n\n`;
  if (formattedText) userMessage += `LIVE WEB RESEARCH:\n${formattedText}\n\n`;
  userMessage += `DECISION TO ANALYSE:\n${decision}`;

  // Phase 1: Drafting
  const draftData: Record<string, any> = {};
  
  const phase1Promises = activeMembers.map(async (member) => {
    emit({ type: 'member_start', memberId: member.id, memberName: member.name });
    try {
      const data = await getMemberDraft(member, userMessage);
      draftData[member.id] = data;
      emit({ type: 'member_thinking', memberId: member.id, stages: data.stages });
    } catch (e: any) {
      if (e.message === 'OLLAMA_CONNECTION' || e.message === 'OLLAMA_MODEL') throw e;
    }
  });
  await Promise.allSettled(phase1Promises);

  // Phase 2: Peer Review & Final Synthesis
  const phase2Promises = activeMembers.map(async (member) => {
    const start = Date.now();
    try {
      const data = draftData[member.id];
      if (!data) throw new Error("Draft failed");

      const peers = activeMembers.filter(m => m.id !== member.id && draftData[m.id]).map(m => ({
        name: m.name,
        draft: draftData[m.id].draftResponse
      }));

      const { rawResponse, formattedResponse, confidence } = await getMemberFinal(member, decision, userMessage, data.draftResponse, data.traces, data.stages, peers);
      
      emit({ type: 'member_thinking', memberId: member.id, stages: data.stages });

      const { hallucinationRisk, flags, cleanedResponse } = await auditResponse(decision, member.name, formattedResponse);

      const response: CouncilResponse = {
        memberId: member.id,
        memberName: member.name,
        rawResponse,
        auditedResponse: cleanedResponse,
        hallucinationRisk,
        flags,
        latencyMs: Date.now() - start,
        confidence,
        thinkingStages: data.stages
      };

      emit({ type: 'member_done', memberId: member.id, response });
      return response;
    } catch (error: any) {
      if (error.message === 'OLLAMA_CONNECTION' || error.message === 'OLLAMA_MODEL') throw error;
      const response: CouncilResponse = {
        memberId: member.id,
        memberName: member.name,
        rawResponse: '[MEMBER UNAVAILABLE]',
        auditedResponse: '[MEMBER UNAVAILABLE]',
        hallucinationRisk: 'UNKNOWN',
        flags: [],
        latencyMs: Date.now() - start,
        error: error.message
      };
      emit({ type: 'member_done', memberId: member.id, response });
      return response;
    }
  });

  const results = await Promise.allSettled(phase2Promises);
  const memberResponses: CouncilResponse[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      memberId: activeMembers[i].id,
      memberName: activeMembers[i].name,
      rawResponse: '[MEMBER UNAVAILABLE]',
      auditedResponse: '[MEMBER UNAVAILABLE]',
      hallucinationRisk: 'UNKNOWN',
      flags: [],
      latencyMs: 0,
      error: 'Unhandled rejection'
    };
  });

  emit({ type: 'synthesis_start' });
  const synthesis = await synthesize(decision, memberResponses);
  emit({ type: 'synthesis_done', synthesis });

  const session: CouncilSession = {
    sessionId,
    timestamp: new Date().toISOString(),
    rawDecision: decision,
    decisionType: type,
    contextUsed,
    webResearch: structuredData || undefined,
    memberResponses,
    synthesis,
    followUps: []
  };

  saveSession(session);
  emit({ type: 'session_done', session });
  return session;
}

// ─── FOLLOW-UP ────────────────────────────────────────────────────────────────
export async function runFollowUp(
  session: CouncilSession,
  question: string,
  targetMemberId: string | 'council'
): Promise<FollowUp> {
  let prompt = `Session Context:\nDecision: ${session.rawDecision}\n\n`;
  let systemPrompt = '';
  let model = process.env.MODEL_SYNTHESIS || 'llama3.1';

  if (targetMemberId === 'council') {
    systemPrompt = `You are The Council Synthesizer. Based on the previous debate and synthesis, directly answer the user's follow-up question in 2-3 focused paragraphs.
Be concrete. Do not repeat what was already said. Add new insight.
Grounding rules: only reference what was in the original decision or the previous synthesis.`;
    prompt += 'Previous Synthesis:\n' + session.synthesis.finalVerdict + '\n\nFollow-up question: ' + question;
  } else {
    const member = members.find(m => m.id === targetMemberId);
    if (!member) throw new Error('Member not found');
    model = member.model;
    systemPrompt = `${member.systemPrompt}

IMPORTANT: You are answering a follow-up question. Respond as raw text (no JSON required).
Build on your previous perspective — do not repeat it, extend it.
Apply your framework (${member.title}) specifically to this new question.`;
    const prevResponse = session.memberResponses.find(r => r.memberId === targetMemberId)?.auditedResponse;
    prompt += 'Your previous perspective:\n' + prevResponse + '\n\nFollow-up question: ' + question;
  }

  const response = await callOllama(systemPrompt, prompt, model, { temperature: 0.4, num_predict: 500 });

  const followUp: FollowUp = {
    timestamp: new Date().toISOString(),
    question,
    targetMemberId,
    response
  };

  session.followUps = session.followUps || [];
  session.followUps.push(followUp);
  saveSession(session);
  return followUp;
}
