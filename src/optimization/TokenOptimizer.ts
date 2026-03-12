/**
 * TokenOptimizer - Intelligent context compression and management
 * 
 * Harvested from: patchy631/ai-engineering-hub/context-engineering-pipeline
 * Adapted for: Business-OS multi-agent context management
 * 
 * Key Features:
 * - Context window tracking per agent
 * - Intelligent summarization of long conversations
 * - Priority-based context inclusion (tools > errors > code > discussion)
 * - Memory management for long-running sessions
 */

export interface ContextChunk {
    content: string;
    priority: number;  // 1-10, higher = more important
    source: 'tool' | 'error' | 'code' | 'discussion' | 'memory';
    timestamp: number;
    tokens: number;  // Estimated token count
}

export interface ContextBudget {
    maxTokens: number;
    reservedForSystem: number;  // System prompts
    reservedForResponse: number;  // Expected response size
    available: number;  // Calculated: max - system - response
}

export interface Message {
    role: string;
    content: string;
}

export class TokenOptimizer {
    private maxTokens: number;
    private systemTokens: number;
    private responseTokens: number;
    private availableTokens: number;

    // Context priority rules (harvested from AI Hub)
    private priorityWeights: Record<string, number> = {
        error: 10,      // Errors are critical context
        tool: 9,        // Tool results highly relevant
        code: 8,        // Code changes important
        memory: 7,      // Long-term memory valuable
        discussion: 5,  // General chat less critical
    };

    constructor(
        maxContextTokens: number = 200000,  // Claude 3.7 Sonnet limit
        systemPromptTokens: number = 2000,
        responseBudgetTokens: number = 4000
    ) {
        this.maxTokens = maxContextTokens;
        this.systemTokens = systemPromptTokens;
        this.responseTokens = responseBudgetTokens;
        this.availableTokens = maxContextTokens - systemPromptTokens - responseBudgetTokens;
    }

    /**
     * Estimate token count (rough heuristic: 1 token ≈ 4 chars)
     * For production, use tiktoken or similar
     */
    estimateTokens(text: string): number {
        return Math.floor(text.length / 4);
    }

    /**
     * Compress context chunks to fit within budget using priority-based selection
     * 
     * Strategy (from AI Hub):
     * 1. Sort chunks by priority (high → low)
     * 2. Include chunks until budget exhausted
     * 3. Summarize excluded low-priority chunks if needed
     */
    compressContext(
        chunks: ContextChunk[],
        budget?: number
    ): ContextChunk[] {
        const targetBudget = budget ?? this.availableTokens;

        // Sort by priority (descending), then timestamp (recent first)
        const sortedChunks = chunks.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return b.timestamp - a.timestamp;
        });

        const selected: ContextChunk[] = [];
        let totalTokens = 0;

        for (const chunk of sortedChunks) {
            if (totalTokens + chunk.tokens <= targetBudget) {
                selected.push(chunk);
                totalTokens += chunk.tokens;
            } else {
                // Budget exhausted
                break;
            }
        }

        return selected;
    }

    /**
     * Create a context chunk from raw content
     */
    createChunk(
        content: string,
        source: 'tool' | 'error' | 'code' | 'discussion' | 'memory',
        timestamp?: number
    ): ContextChunk {
        const ts = timestamp ?? Date.now();

        return {
            content,
            priority: this.priorityWeights[source] ?? 5,
            source,
            timestamp: ts,
            tokens: this.estimateTokens(content)
        };
    }

    /**
     * Summarize a long conversation into key points
     * 
     * For now, extract key information. In production, use LLM summarization.
     */
    summarizeConversation(
        messages: Message[],
        targetTokens: number = 1000
    ): string {
        // Simple heuristic: extract tool calls, errors, and key decisions
        const keyPoints: string[] = [];

        for (const msg of messages) {
            const content = msg.content || '';
            const role = msg.role || '';

            // Extract tool calls
            if (content.includes('tool_use') || content.toLowerCase().includes('bash')) {
                keyPoints.push(`Tool: ${content.substring(0, 100)}`);
            }

            // Extract errors
            if (content.toLowerCase().includes('error') || content.toLowerCase().includes('failed')) {
                keyPoints.push(`Error: ${content.substring(0, 100)}`);
            }

            // Extract decisions (if from user)
            if (role === 'user' && content.length < 200) {
                keyPoints.push(`User: ${content}`);
            }
        }

        const summary = keyPoints.length > 0
            ? "Conversation Summary:\n" + keyPoints.slice(0, 10).join("\n")
            : "No significant events.";

        return summary;
    }

    /**
     * Get current token budget status
     */
    getBudgetStatus(): ContextBudget & { utilizationPct: number } {
        return {
            maxTokens: this.maxTokens,
            reservedForSystem: this.systemTokens,
            reservedForResponse: this.responseTokens,
            available: this.availableTokens,
            utilizationPct: Math.floor((1 - this.availableTokens / this.maxTokens) * 100)
        };
    }
}

// Global instance
export const tokenOptimizer = new TokenOptimizer();
