import chalk from 'chalk';
import boxen from 'boxen';
import ora, { Ora } from 'ora';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { CouncilMember, CouncilResponse, SynthesisResult } from './types';

marked.setOptions({ renderer: new TerminalRenderer() as any });

export function renderBanner() {
  console.log(
    boxen(chalk.bold.white('THE COUNCIL'), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'white'
    })
  );
}

export function renderDecisionHeader(decision: string, type: string, contextUsed: string) {
  const truncated = decision.length > 100 ? decision.slice(0, 97) + '...' : decision;
  let text = `${chalk.bold('Decision:')} ${truncated}\n${chalk.bold('Type:')} ${chalk.bgBlue.white(` ${type.toUpperCase()} `)}`;
  if (contextUsed) {
    text += `\n\n${chalk.cyan('📚 Grounded with real-world cases')}`;
  }
  console.log(boxen(text, { padding: 1, margin: { top: 1, bottom: 1 }, borderColor: 'gray' }));
}

export function renderMemberResponse(member: CouncilMember, response: CouncilResponse) {
  const colorFn = (chalk as any)[member.color] || chalk.white;
  
  let riskBadge = '';
  if (response.hallucinationRisk === 'LOW') riskBadge = chalk.bgGreen.black(' RISK: LOW ');
  else if (response.hallucinationRisk === 'MEDIUM') riskBadge = chalk.bgYellow.black(' RISK: MEDIUM ');
  else if (response.hallucinationRisk === 'HIGH') riskBadge = chalk.bgRed.white(' RISK: HIGH ');
  else riskBadge = chalk.bgGray.white(' RISK: UNKNOWN ');

  let header = colorFn.bold(`${member.name} - ${member.title}`) + ` (${response.latencyMs}ms) ` + riskBadge;
  
  if (response.flags.length > 0) {
    header += chalk.yellow(`\nFlags: ${response.flags.join(', ')}`);
  }

  console.log(`\n${header}`);
  console.log(colorFn('─'.repeat(50)));
  console.log(marked.parse(response.auditedResponse));
  console.log(colorFn('─'.repeat(50)) + '\n');
}

export function renderSynthesis(synthesis: SynthesisResult) {
  const confBar = Array(10).fill('░');
  const filledCount = Math.round(synthesis.confidenceScore / 10);
  for (let i = 0; i < filledCount; i++) confBar[i] = '█';
  
  let confColor = chalk.red;
  if (synthesis.confidenceScore > 70) confColor = chalk.green;
  else if (synthesis.confidenceScore > 40) confColor = chalk.yellow;
  
  const barStr = confColor(confBar.join(''));

  let text = `${chalk.bold('CONSENSUS:')}\n${synthesis.consensus}\n\n`;
  text += `${chalk.bold('CORE TENSION:')}\n${synthesis.coreTension}\n\n`;
  text += `${chalk.bold('FINAL VERDICT:')}\n${synthesis.finalVerdict}\n\n`;
  text += `${chalk.bold('CONFIDENCE:')} [${barStr}] ${synthesis.confidenceScore}%\n\n`;
  
  if (synthesis.questionsToAnswer.length > 0) {
    text += `${chalk.bold('QUESTIONS TO ANSWER:')}\n`;
    synthesis.questionsToAnswer.forEach((q, i) => {
      text += `${i + 1}. ${q}\n`;
    });
  }

  if (synthesis.parseError) {
    text += chalk.red(`\n[WARNING] Synthesis partially failed to parse. Returning raw fallback.\n`);
  }

  console.log(
    boxen(text, {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: 'double',
      borderColor: 'magenta'
    })
  );
}

export function renderSessionSaved(id: string) {
  console.log(chalk.dim(`Session saved: ./sessions/${id}.json\n`));
}

export function renderError(msg: string) {
  console.log(boxen(chalk.red(msg), { padding: 1, borderColor: 'red' }));
}

export function createSpinner(text: string): Ora {
  return ora(text);
}
