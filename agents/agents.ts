/**
 * Vibecraft Agent Implementations
 *
 * OrchestratorAgent  — plans, breaks down tasks, delegates, reviews
 * CoderAgent         — writes and edits TypeScript/JS code
 * ReviewerAgent      — checks code for bugs, security issues, style
 * ResearcherAgent    — fetches docs via chub, annotates context
 * TesterAgent        — validates outputs, runs tests
 * ScribeAgent        — writes docs, changelogs, READMEs
 */

import { AgentBus, TaskPayload, ResultPayload } from './agent-bus.js';
import { BaseAgent } from './base-agent.js';
import { AgentMessage } from './agent-bus.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class OrchestratorAgent extends BaseAgent {
  private pendingTasks = new Map<string, { task: TaskPayload; from: string }>();
  private completedTasks: ResultPayload[] = [];

  constructor(bus: AgentBus, id?: string) {
    super({ id: id ?? 'orchestrator-main', role: 'orchestrator', capabilities: ['plan', 'delegate', 'review', 'synthesize'], trustLevel: 1 }, bus);
  }

  async executeTask(task: TaskPayload, msg: AgentMessage): Promise<ResultPayload> {
    this.log('orchestrate', task.title);

    // Break task into subtasks and delegate
    const plan = await this.plan(task);
    this.pushContext(`plan:${task.title}`, JSON.stringify(plan));

    for (const subtask of plan.subtasks) {
      const targetAgent = this.pickAgent(subtask.requiredRole);
      if (targetAgent) {
        this.task(targetAgent, subtask.title, subtask.description, {
          context: subtask.contextKeys,
          constraints: task.constraints,
        });
      }
    }

    return {
      success: true,
      output: { plan, status: 'delegated' },
      contextAnnotations: [{ key: `orchestration:${task.title}`, note: `Plan created with ${plan.subtasks.length} subtasks`, confidence: 'high' }],
    };
  }

  private async plan(task: TaskPayload): Promise<{ subtasks: Array<{ title: string; description: string; requiredRole: string; contextKeys?: string[] }> }> {
    // In production this calls the Claude API. Here we return a structured plan.
    return {
      subtasks: [
        { title: `Research: ${task.title}`, description: `Fetch relevant docs and context for: ${task.description}`, requiredRole: 'researcher', contextKeys: task.context },
        { title: `Implement: ${task.title}`, description: task.description, requiredRole: 'coder', contextKeys: task.context },
        { title: `Review: ${task.title}`, description: `Review the implementation of: ${task.description}`, requiredRole: 'reviewer' },
        { title: `Test: ${task.title}`, description: `Write and run tests for: ${task.description}`, requiredRole: 'tester' },
        { title: `Document: ${task.title}`, description: `Write docs for: ${task.description}`, requiredRole: 'scribe' },
      ],
    };
  }

  private pickAgent(role: string): string | null {
    const agents = this.bus.agents.filter((a) => a.role === role && a.id !== this.identity.id);
    return agents[0]?.id ?? null;
  }

  protected async onResult(msg: AgentMessage, result: ResultPayload): Promise<void> {
    this.completedTasks.push(result);
    this.log('result:received', `From ${msg.from}: ${result.success ? '✅' : '❌'}`);

    // Broadcast progress to all agents
    this.broadcast({
      event: 'task_complete',
      from: msg.from,
      success: result.success,
      completedCount: this.completedTasks.length,
    });
  }

  getSummary() {
    return {
      pending: this.pendingTasks.size,
      completed: this.completedTasks.length,
      successRate: this.completedTasks.length
        ? this.completedTasks.filter((t) => t.success).length / this.completedTasks.length
        : 0,
    };
  }
}

// ─── Coder ────────────────────────────────────────────────────────────────────

export class CoderAgent extends BaseAgent {
  private outputDir: string;

  constructor(bus: AgentBus, outputDir = './output', id?: string) {
    super({ id: id ?? `coder-${Math.random().toString(36).slice(2, 6)}`, role: 'coder', capabilities: ['write_code', 'edit_code', 'refactor', 'typescript', 'javascript'], trustLevel: 2 }, bus);
    this.outputDir = outputDir;
  }

  async executeTask(task: TaskPayload, _msg: AgentMessage): Promise<ResultPayload> {
    this.log('code', task.title);

    // Pull any context this task needs
    const contextContent: string[] = [];
    if (task.context) {
      for (const key of task.context) {
        const c = this.pullContext(key);
        if (c) contextContent.push(`// Context: ${key}\n${c}`);
      }
    }

    // In production: call Claude API with the task + context
    // Here we generate a scaffold as a demonstration
    const code = this.generateScaffold(task, contextContent);
    const filename = `${task.title.replace(/\s+/g, '_').toLowerCase()}.ts`;
    const filepath = path.join(this.outputDir, filename);

    try {
      fs.mkdirSync(this.outputDir, { recursive: true });
      fs.writeFileSync(filepath, code, 'utf-8');
    } catch (e) {
      return { success: false, error: String(e), output: null };
    }

    return {
      success: true,
      output: { filepath, linesWritten: code.split('\n').length },
      filesChanged: [filepath],
      contextAnnotations: [
        { key: `code:${task.title}`, note: `Wrote ${filename} — ${code.split('\n').length} lines`, confidence: 'high' },
      ],
    };
  }

  private generateScaffold(task: TaskPayload, context: string[]): string {
    return `/**
 * ${task.title}
 * Generated by CoderAgent
 *
 * Task: ${task.description}
 */

${context.join('\n\n')}

// TODO: Implement ${task.title}
export function main() {
  // Implementation goes here
  console.log('${task.title} running...');
}
`;
  }
}

// ─── Reviewer ─────────────────────────────────────────────────────────────────

export class ReviewerAgent extends BaseAgent {
  constructor(bus: AgentBus, id?: string) {
    super({ id: id ?? `reviewer-${Math.random().toString(36).slice(2, 6)}`, role: 'reviewer', capabilities: ['review_code', 'security_check', 'style_check', 'suggest_improvements'], trustLevel: 2 }, bus);
  }

  async executeTask(task: TaskPayload, _msg: AgentMessage): Promise<ResultPayload> {
    this.log('review', task.title);

    const findings: string[] = [];
    const security: string[] = [];

    if (task.artifacts) {
      for (const filepath of task.artifacts) {
        try {
          const code = fs.readFileSync(filepath, 'utf-8');
          findings.push(...this.reviewCode(code, filepath));
          security.push(...this.securityScan(code, filepath));
        } catch {
          findings.push(`Could not read ${filepath}`);
        }
      }
    }

    const passed = security.length === 0;

    return {
      success: passed,
      output: { findings, securityIssues: security, passed },
      contextAnnotations: security.map((s) => ({
        key: `security:${task.title}`,
        note: s,
        confidence: 'high' as const,
      })),
      error: passed ? undefined : `${security.length} security issue(s) found`,
    };
  }

  private reviewCode(code: string, filepath: string): string[] {
    const issues: string[] = [];
    if (!code.includes('// ')) issues.push(`${filepath}: Missing inline comments`);
    if (code.includes('any')) issues.push(`${filepath}: Avoid using 'any' type`);
    if (code.includes('console.log') && !filepath.includes('test')) issues.push(`${filepath}: Remove debug console.log`);
    return issues;
  }

  private securityScan(code: string, filepath: string): string[] {
    const issues: string[] = [];
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, label: 'eval() usage' },
      { pattern: /dangerouslySetInnerHTML/, label: 'dangerouslySetInnerHTML' },
      { pattern: /exec\s*\(.*\$\{/, label: 'Shell injection risk' },
      { pattern: /ignore previous|you are now|new identity/i, label: 'Prompt injection attempt' },
    ];
    for (const { pattern, label } of dangerousPatterns) {
      if (pattern.test(code)) issues.push(`${filepath}: ⚠️ ${label}`);
    }
    return issues;
  }
}

// ─── Researcher ───────────────────────────────────────────────────────────────

export class ResearcherAgent extends BaseAgent {
  constructor(bus: AgentBus, id?: string) {
    super({ id: id ?? `researcher-${Math.random().toString(36).slice(2, 6)}`, role: 'researcher', capabilities: ['fetch_docs', 'chub_search', 'annotate', 'web_search'], trustLevel: 2 }, bus);
  }

  async executeTask(task: TaskPayload, _msg: AgentMessage): Promise<ResultPayload> {
    this.log('research', task.title);

    const results: Record<string, string> = {};
    const annotations: Array<{ key: string; note: string; confidence: 'high' | 'medium' | 'low' }> = [];

    // Try chub CLI if available
    if (task.context) {
      for (const key of task.context) {
        const result = this.fetchFromChub(key);
        if (result) {
          results[key] = result;
          this.bus.hub.set(`chub:${key}`, result, this.identity.id);
          annotations.push({ key: `chub:${key}`, note: `Fetched from context-hub`, confidence: 'high' });
        }
      }
    }

    // Store findings in hub
    const summary = `Research complete for: ${task.description}\nSources: ${Object.keys(results).join(', ')}`;
    this.pushContext(`research:${task.title}`, summary);

    return {
      success: true,
      output: { results, summary },
      contextAnnotations: annotations,
    };
  }

  private fetchFromChub(docId: string): string | null {
    try {
      // Calls the real chub CLI if installed
      const result = execSync(`npx @aisuite/chub get ${docId} 2>/dev/null`, { timeout: 10_000 }).toString();
      return result.trim() || null;
    } catch {
      // chub not available or doc not found — return null gracefully
      return null;
    }
  }
}

// ─── Tester ───────────────────────────────────────────────────────────────────

export class TesterAgent extends BaseAgent {
  constructor(bus: AgentBus, id?: string) {
    super({ id: id ?? `tester-${Math.random().toString(36).slice(2, 6)}`, role: 'tester', capabilities: ['write_tests', 'run_tests', 'validate_output', 'typescript'], trustLevel: 2 }, bus);
  }

  async executeTask(task: TaskPayload, _msg: AgentMessage): Promise<ResultPayload> {
    this.log('test', task.title);

    const testResults: { file: string; passed: boolean; output: string }[] = [];

    if (task.artifacts) {
      for (const filepath of task.artifacts) {
        const result = this.runTest(filepath);
        testResults.push(result);
      }
    }

    const allPassed = testResults.every((r) => r.passed);

    return {
      success: allPassed,
      output: { testResults, allPassed },
      contextAnnotations: allPassed
        ? [{ key: `tests:${task.title}`, note: 'All tests passed', confidence: 'high' }]
        : testResults.filter((r) => !r.passed).map((r) => ({
            key: `test:failure:${r.file}`,
            note: r.output,
            confidence: 'high' as const,
          })),
      error: allPassed ? undefined : `${testResults.filter((r) => !r.passed).length} test(s) failed`,
    };
  }

  private runTest(filepath: string): { file: string; passed: boolean; output: string } {
    try {
      const output = execSync(`npx tsx ${filepath} 2>&1`, { timeout: 30_000 }).toString();
      return { file: filepath, passed: true, output };
    } catch (err: unknown) {
      const output = err instanceof Error && 'stdout' in err ? String((err as NodeJS.ErrnoException).message) : String(err);
      return { file: filepath, passed: false, output };
    }
  }
}

// ─── Scribe ───────────────────────────────────────────────────────────────────

export class ScribeAgent extends BaseAgent {
  private docsDir: string;

  constructor(bus: AgentBus, docsDir = './docs', id?: string) {
    super({ id: id ?? `scribe-${Math.random().toString(36).slice(2, 6)}`, role: 'scribe', capabilities: ['write_docs', 'write_changelog', 'write_readme', 'summarize'], trustLevel: 2 }, bus);
    this.docsDir = docsDir;
  }

  async executeTask(task: TaskPayload, _msg: AgentMessage): Promise<ResultPayload> {
    this.log('scribe', task.title);

    const contextItems: string[] = [];
    if (task.context) {
      for (const key of task.context) {
        const c = this.pullContext(key);
        if (c) contextItems.push(`## ${key}\n${c}`);
      }
    }

    const doc = this.generateDoc(task, contextItems);
    const filename = `${task.title.replace(/\s+/g, '_').toLowerCase()}.md`;
    const filepath = path.join(this.docsDir, filename);

    try {
      fs.mkdirSync(this.docsDir, { recursive: true });
      fs.writeFileSync(filepath, doc, 'utf-8');
    } catch (e) {
      return { success: false, error: String(e), output: null };
    }

    return {
      success: true,
      output: { filepath, wordCount: doc.split(' ').length },
      filesChanged: [filepath],
    };
  }

  private generateDoc(task: TaskPayload, contextItems: string[]): string {
    return `# ${task.title}

> ${task.description}

Generated: ${new Date().toISOString()}

${contextItems.join('\n\n')}

---
*Auto-generated by ScribeAgent*
`;
  }
}
