import fs from 'fs';

const councilPath = './src/council.ts';
let code = fs.readFileSync(councilPath, 'utf8');

// The replacement starts exactly at "export interface ThinkingStage {"
// and goes all the way down to "  const memberResponses: CouncilResponse[] = results.map((r, i) => {"

const newImplementation = `export interface ThinkingStage {
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
    stages.push({ id, label, content: \`[\${label} unavailable]\` });
    return \`[\${label} unavailable]\`;
  }
}

async function getMemberDraft(
  member: any,
  userMessage: string
): Promise<{ draftResponse: string; stages: ThinkingStage[]; traces: string }> {
  const stages: ThinkingStage[] = [];
  
  const parseResult = await tryStage(member, stages, 'parse', 'PARSE',
    \`You are \${member.name}. You are preparing to advise on a decision. Before anything else, do a rigorous fact inventory.\`,
    \`\${userMessage}\\n\\nList facts, unknowns, assumptions. No JSON.\`,
    { temperature: 0.15, top_p: 0.5, num_predict: 600 }
  );

  const principlesResult = await tryStage(member, stages, 'first_principles', 'FIRST PRINCIPLES',
    \`You are \${member.name}. Strip this problem down to its fundamental, undeniable truths.\`,
    \`\${userMessage}\\n\\nYour fact inventory:\\n\${parseResult}\\n\\nWhat are the absolute core truths here that cannot be violated? Reason up from there.\`,
    { temperature: member.temperature, top_p: 0.7, num_predict: 400 }
  );

  const steelmanResult = await tryStage(member, stages, 'steelman', 'STEELMAN',
    \`You are \${member.name}. Play devil's advocate against yourself.\`,
    \`\${userMessage}\\n\\nYour core truths:\\n\${principlesResult}\\n\\nBuild the STRONGEST POSSIBLE ARGUMENT against your own initial direction.\`,
    { temperature: member.temperature + 0.15, top_p: 0.85, num_predict: 500 }
  );

  const pressureTestResult = await tryStage(member, stages, 'pressure_test', 'PRESSURE TEST',
    \`You are \${member.name}. Adjudicate between your original direction and the steelman.\`,
    \`\${userMessage}\\n\\nSteelman:\\n\${steelmanResult}\\n\\nWhat lands? What can you rebut? What is your post-stress position?\`,
    { temperature: member.temperature, top_p: member.topP ?? 0.7, num_predict: 500 }
  );

  const secondOrderResult = await tryStage(member, stages, 'second_order', 'SECOND-ORDER EFFECTS',
    \`You are \${member.name}. Map out the unintended consequences.\`,
    \`\${userMessage}\\n\\nIf we follow your post-stress position (\${pressureTestResult}), what happens at 6 months? 1 year? 5 years? What breaks?\`,
    { temperature: member.temperature + 0.1, top_p: 0.8, num_predict: 500 }
  );

  const premortemResult = await tryStage(member, stages, 'pre_mortem', 'PRE-MORTEM',
    \`You are \${member.name}, conducting a pre-mortem analysis.\`,
    \`\${userMessage}\\n\\nAssume the decision fails spectacularly in 12 months. Write the post-mortem from the future. Why did it fail?\`,
    { temperature: member.temperature + 0.1, top_p: 0.8, num_predict: 500 }
  );

  const traces = \`[PARSE]\\n\${parseResult}\\n[FIRST PRINCIPLES]\\n\${principlesResult}\\n[STEELMAN]\\n\${steelmanResult}\\n[PRESSURE TEST]\\n\${pressureTestResult}\\n[SECOND-ORDER EFFECTS]\\n\${secondOrderResult}\\n[PRE-MORTEM]\\n\${premortemResult}\`;

  const draftPrompt = \`\${userMessage}\\n\\n--- YOUR DEEP REASONING TRACE ---\\n\${traces}\\n---\\n\\nNow write a preliminary structured JSON answer.\`;

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
  
  let peerText = peerDrafts.map(p => \`--- \${p.name}'s Draft ---\\n\${p.draft}\`).join('\\n\\n');
  if (!peerText) peerText = "No peers available.";

  const peerReviewResult = await tryStage(member, stages, 'peer_review', 'PEER REVIEW',
    \`You are \${member.name}. Read the drafts of your fellow council members and critique them.\`,
    \`Here is the decision:\\n\${decision}\\n\\nHere are the drafts of your peers:\\n\\n\${peerText}\\n\\nWhat did they miss? Where is their logic flawed? How can you incorporate their best points into your own advice?\`,
    { temperature: 0.2, top_p: 0.6, num_predict: 500 }
  );

  const crossExamineResult = await tryStage(member, stages, 'cross_examination', 'CROSS-EXAMINATION',
    \`You are \${member.name}, reviewing your own drafted answer to find weaknesses.\`,
    \`Here is the original decision:\\n\${decision}\\n\\nHere is your drafted JSON answer:\\n\${draftResponse}\\n\\nCritique this draft ruthlessly.\`,
    { temperature: 0.15, top_p: 0.5, num_predict: 600 }
  );

  const finalPrompt = \`\${userMessage}\\n\\n--- YOUR DEEP REASONING TRACE ---\\n\${traces}\\n\\n--- YOUR PEER REVIEW ---\\n\${peerReviewResult}\\n\\n--- YOUR CROSS-EXAMINATION OF YOUR DRAFT ---\\n\${crossExamineResult}\\n\\nRewrite your structured JSON answer. You MUST fix the specific flaws identified in your cross-examination and incorporate insights from your peer review.\`;

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
        formattedResponse += \`**[\${label}]**\\n\${parsed[key]}\\n\\n\`;
      }
    }
  } catch {
    formattedResponse = finalRaw;
  }

  return { rawResponse: finalRaw, formattedResponse, confidence };
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────
export async function runCouncil(
  decision: string,
  selectedMemberIds: string[],
  onProgress?: (event: ProgressEvent) => void
): Promise<CouncilSession> {
  const sessionId = nanoid(8);
  const emit = (event: ProgressEvent) => { if (onProgress) onProgress(event); };

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
  if (contextUsed) userMessage += \`CONTEXT FROM SIMILAR CASES:\\n\${contextUsed}\\n\\n\`;
  if (formattedText) userMessage += \`LIVE WEB RESEARCH:\\n\${formattedText}\\n\\n\`;
  userMessage += \`DECISION TO ANALYSE:\\n\${decision}\`;

  const activeMembers = members.filter(m => selectedMemberIds.includes(m.id));

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
`;

const startIndex = code.indexOf('export interface ThinkingStage {');
const endIndexStr = '  const memberResponses: CouncilResponse[] = results.map((r, i) => {';
const endIndex = code.indexOf(endIndexStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const before = code.substring(0, startIndex);
const after = code.substring(endIndex);

const newCode = before + newImplementation + after;
fs.writeFileSync(councilPath, newCode);
console.log("Updated council.ts");
