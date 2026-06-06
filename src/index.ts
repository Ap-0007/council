import * as p from '@clack/prompts';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { runCouncil, runFollowUp } from './council.js';
import { members } from './members.js';
import { listSessions, searchSessions, loadSession, exportToMarkdown } from './session.js';
import { marked } from 'marked';
import {
  renderBanner,
  renderDecisionHeader,
  renderMemberResponse,
  renderSynthesis,
  renderSessionSaved,
  renderError,
  createSpinner
} from './renderer.js';
import { CouncilSession } from './types.js';

dotenv.config();

process.on('SIGINT', () => {
  p.outro('👋 The Council is dismissed.');
  process.exit(0);
});

async function checkOllama() {
  const url = process.env.OLLAMA_URL || 'http://localhost:11434';
  try {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) throw new Error();
  } catch (e) {
    renderError(`Cannot connect to Ollama at ${url}.\nRun: ollama serve`);
    process.exit(1);
  }
}

async function promptFollowUp(session: CouncilSession) {
  while (true) {
    const action = await p.select({
      message: 'Session Options:',
      options: [
        { value: 'followup', label: '🗣️ Ask a follow-up question' },
        { value: 'export', label: '📄 Export to Markdown' },
        { value: 'back', label: '⬅ Go back' }
      ]
    });

    if (p.isCancel(action) || action === 'back') break;

    if (action === 'export') {
      const path = exportToMarkdown(session);
      p.log.success(`Exported successfully to ${path}`);
      continue;
    }

    if (action === 'followup') {
      const targetOptions = session.memberResponses.map(r => ({
        value: r.memberId,
        label: members.find(m => m.id === r.memberId)?.name || r.memberId
      }));
      targetOptions.unshift({ value: 'council', label: 'The Council (Synthesizer)' });

      const target = await p.select({
        message: 'Who would you like to ask?',
        options: targetOptions
      });

      if (p.isCancel(target)) continue;

      const question = await p.text({
        message: 'What is your follow-up question?',
        validate: (value) => {
          if (value.length < 5) return 'Please ask a detailed question.';
        }
      });

      if (p.isCancel(question)) continue;

      const spinner = createSpinner('Thinking...').start();
      try {
        const followUp = await runFollowUp(session, question as string, target as string);
        spinner.succeed('Answer received.');
        
        console.log(`\n${chalk.bold.cyan('Q: ' + followUp.question)}`);
        const responder = target === 'council' ? 'The Council' : members.find(m => m.id === target)?.name;
        console.log(`${chalk.bold.magenta(responder + ':')}`);
        console.log(marked.parse(followUp.response));
        console.log(chalk.gray('─'.repeat(50)) + '\n');
      } catch (err: any) {
        spinner.fail('Follow-up failed.');
        renderError(err.message);
      }
    }
  }
}

async function renderFullSession(session: CouncilSession) {
  renderDecisionHeader(session.rawDecision, session.decisionType, session.contextUsed);
  session.memberResponses.forEach(res => {
    const member = members.find(m => m.id === res.memberId);
    if (member) renderMemberResponse(member, res);
  });
  renderSynthesis(session.synthesis);

  if (session.followUps && session.followUps.length > 0) {
    console.log(chalk.bold.cyan('\n=== FOLLOW-UP QUESTIONS ===\n'));
    session.followUps.forEach(f => {
      console.log(`\n${chalk.bold.cyan('Q: ' + f.question)}`);
      const responder = f.targetMemberId === 'council' ? 'The Council' : members.find(m => m.id === f.targetMemberId)?.name;
      console.log(`${chalk.bold.magenta(responder + ':')}`);
      console.log(marked.parse(f.response));
      console.log(chalk.gray('─'.repeat(50)) + '\n');
    });
  }

  await promptFollowUp(session);
}

async function handleViewSessions(sessions: any[]) {
  if (sessions.length === 0) {
    p.log.warn('No sessions found.');
    return;
  }
  const choices = sessions.map(s => ({
    value: s.sessionId,
    label: `${s.timestamp.split('T')[0]} [${s.decisionType.toUpperCase()}] ${s.preview}...`
  }));
  
  const selected = await p.select({
    message: 'Select a session to view:',
    options: [...choices, { value: 'back', label: '⬅ Go back' }]
  });

  if (p.isCancel(selected) || selected === 'back') return;

  const session = loadSession(selected as string);
  if (session) {
    await renderFullSession(session);
  }
}

async function mainLoop() {
  while (true) {
    const choice = await p.select({
      message: 'What would you like to do?',
      options: [
        { value: 'submit', label: '⚡ Submit decision' },
        { value: 'view', label: '📁 View past sessions' },
        { value: 'search', label: '🔍 Search sessions' },
        { value: 'exit', label: '🚪 Exit' }
      ]
    });

    if (p.isCancel(choice) || choice === 'exit') {
      p.outro('👋 The Council is dismissed.');
      process.exit(0);
    }

    if (choice === 'submit') {
      const selectedMembers = await p.multiselect({
        message: 'Select the council members to convene:',
        options: members.map(m => ({ value: m.id, label: `${m.name} (${m.title})` })),
        initialValues: members.map(m => m.id),
        required: true
      });

      if (p.isCancel(selectedMembers)) continue;

      const decision = await p.text({
        message: 'Enter your decision context (min 20 chars):',
        validate: (value) => {
          if (value.length < 20) return 'Please provide more context (min 20 chars).';
        }
      });
      
      if (p.isCancel(decision)) continue;

      const spinner = createSpinner('The Council is convening...').start();
      try {
        const session = await runCouncil(decision as string, selectedMembers as string[], (event) => {
          if (event.type === 'status') spinner.text = event.message;
          else if (event.type === 'member_start') spinner.text = `${event.memberName} is reasoning...`;
          else if (event.type === 'member_done') spinner.text = `${event.response.memberName} has spoken.`;
          else if (event.type === 'synthesis_start') spinner.text = 'Synthesizing perspectives...';
        });
        spinner.succeed('The Council has spoken.');
        
        await renderFullSession(session);
        renderSessionSaved(session.sessionId);
      } catch (error: any) {
        spinner.fail('Council execution failed.');
        if (error.message === 'OLLAMA_CONNECTION') {
          renderError('Run: ollama serve');
        } else if (error.message === 'OLLAMA_MODEL') {
          renderError('Run: ollama pull <model>');
        } else {
          renderError(error.message || 'Unknown error');
        }
      }
    } else if (choice === 'view') {
      const sessions = listSessions();
      await handleViewSessions(sessions);
    } else if (choice === 'search') {
      const keyword = await p.text({
        message: 'Enter keyword to search:'
      });
      if (!p.isCancel(keyword)) {
        const results = searchSessions(keyword as string);
        await handleViewSessions(results);
      }
    }
  }
}

async function main() {
  renderBanner();
  await checkOllama();
  
  process.on('unhandledRejection', (reason) => {
    renderError(`Unhandled Rejection: ${reason}`);
  });

  await mainLoop();
}

main().catch((err) => {
  renderError(`Fatal error: ${err.message}`);
  process.exit(1);
});
