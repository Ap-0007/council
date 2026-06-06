export interface CouncilMember {
  id: string;
  name: string;
  title: string;
  systemPrompt: string;
  temperature: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  model: string;
  color: string;
  formatKeys: string[];
  emoji: string;
}

export interface CouncilResponse {
  memberId: string;
  memberName: string;
  rawResponse: string;
  auditedResponse: string;
  hallucinationRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  flags: string[];
  latencyMs: number;
  confidence?: number;
  thinkingStages?: { id: string; label: string; content: string }[];
  error?: string;
}

export interface SynthesisResult {
  consensus: string;
  coreTension: string;
  finalVerdict: string;
  tradeoffs?: string[];
  actionPlan?: string[];
  confidenceScore: number;
  questionsToAnswer: string[];
  consistencyFlags?: string[];
  parseError?: boolean;
}

export interface FollowUp {
  timestamp: string;
  question: string;
  targetMemberId: string | 'council';
  response: string;
}

export interface WebResearchResult {
  queries: string[];
  results: {
    query: string;
    title: string;
    url: string;
    description: string;
  }[];
}

export interface CouncilSession {
  sessionId: string;
  timestamp: string;
  rawDecision: string;
  decisionType: string;
  contextUsed: string;
  webResearch?: WebResearchResult;
  memberResponses: CouncilResponse[];
  synthesis: SynthesisResult;
  followUps?: FollowUp[];
}

export interface SessionMeta {
  sessionId: string;
  timestamp: string;
  decisionType: string;
  preview: string;
}

export interface AuditResult {
  hallucinationRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  flags: string[];
  cleanedResponse: string;
}

export interface DocIndex {
  filename: string;
  category: string;
  content: string;
  embedding: number[];
}

export type ProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'member_start'; memberId: string; memberName: string }
  | { type: 'member_thinking'; memberId: string; stages: { id: string; label: string; content: string }[] }
  | { type: 'member_done'; memberId: string; response: CouncilResponse }
  | { type: 'web_research_done'; webResearch: WebResearchResult }
  | { type: 'synthesis_start' }
  | { type: 'synthesis_done'; synthesis: SynthesisResult }
  | { type: 'session_done'; session: CouncilSession }
  | { type: 'error'; message: string };
