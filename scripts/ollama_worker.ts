
/**
 * Autonomous Ollama Worker
 * 
 * This script runs a local loop that:
 * 1. Accepts a goal/prompt
 * 2. Uses Ollama (EternalFlame/Bored) to plan and execute tools
 * 3. Executes real file system/shell commands
 * 4. Reports all activity to Vibecraft for visualization
 */

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Configuration
const CONFIG = {
    ollamaUrl: 'http://localhost:11434',
    vibecraftUrl: 'http://localhost:4003', // Default server port
    model: 'EternalFlame/Bored:latest',
    agentId: 'ollama',
    pollingInterval: 5000
}

interface ToolCall {
    name: string
    arguments: Record<string, any>
}

class OllamaWorker {
    private history: { role: string; content: string }[] = []

    constructor() {
        console.log(`[OllamaWorker] Initialized for model: ${CONFIG.model}`)
    }

    /**
     * Main work loop
     */
    async start(goal: string) {
        console.log(`[OllamaWorker] Starting goal: ${goal}`)
        this.history.push({ role: 'user', content: goal })

        // Notify Vibecraft of start
        await this.sendEvent('user_prompt_submit', { prompt: goal })

        let running = true
        while (running) {
            // 1. Get completion from Ollama
            const completion = await this.chat(this.history)
            const content = completion.message.content

            this.history.push({ role: 'assistant', content })

            // 2. Parse for tool calls (simple xml-like or json parsing for now, strictly regex based for robustness on smaller models)
            // Supporting <tool_code> syntax or JSON blocks
            const toolCall = this.parseToolCall(content)

            if (toolCall) {
                console.log(`[OllamaWorker] Tool Call: ${toolCall.name}`)

                // Notify Vibecraft: Pre-Tool
                await this.sendEvent('pre_tool_use', {
                    tool: this.mapToolToVibecraftName(toolCall.name),
                    toolInput: toolCall.arguments,
                    toolUseId: `call_${Date.now()}`
                })

                // 3. Execute Tool
                let result = ''
                let success = true
                const startTime = Date.now()

                try {
                    result = await this.executeTool(toolCall)
                } catch (err: any) {
                    success = false
                    result = `Error: ${err.message}`
                }

                const duration = Date.now() - startTime

                // Notify Vibecraft: Post-Tool
                await this.sendEvent('post_tool_use', {
                    tool: this.mapToolToVibecraftName(toolCall.name),
                    toolInput: toolCall.arguments,
                    toolResponse: { output: result },
                    toolUseId: `call_${Date.now()}`, // In real app, track IDs matching pre_tool
                    success,
                    duration
                })

                // 4. Feed result back to history
                this.history.push({
                    role: 'user',
                    content: `Tool Output [${toolCall.name}]:\n${result}`
                })

            } else {
                // No tool call, just text response OR finished
                if (content.includes('<completed>') || content.toLowerCase().includes('task complete')) {
                    console.log('[OllamaWorker] Task Complete')
                    await this.sendEvent('stop', { response: content })
                    running = false
                } else {
                    // Treating as a text response in the feed (via stop event with response)
                    // In a real loop we might just stream text, but for step-by-step agent events:
                    await this.sendEvent('stop', { response: content })
                    // If it didn't call a tool, we pause or stop to avoid infinite loops if it's just chatting
                    // For this worker, we'll ask for user input or stop if it seems done
                    if (!content.includes('?')) {
                        running = false
                    }
                }
            }
        }
    }

    /**
     * Query Ollama
     */
    async chat(messages: { role: string; content: string }[]) {
        // Inject system prompt for tool use
        const systemPrompt = `You are an autonomous worker agent.
You have access to the following tools:
1. read_file(path): Read a file.
2. write_file(path, content): Write a file.
3. list_files(path): List files in a directory.
4. execute_command(command): Run a shell command.

To use a tool, you MUST use this JSON format in your response:
\`\`\`json
{
  "tool": "tool_name",
  "arguments": { "arg1": "value" }
}
\`\`\`

If you are done, say "Task Complete".
`
        const payload = {
            model: CONFIG.model,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            stream: false,
            options: {
                temperature: 0 // Deterministic for tools
            }
        }

        try {
            const res = await fetch(`${CONFIG.ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) throw new Error(`Ollama Error: ${res.statusText}`)
            return await res.json()
        } catch (err) {
            console.error('Failed to chat with Ollama', err)
            process.exit(1)
        }
    }

    /**
     * Parse Tool Call from text
     */
    parseToolCall(text: string): ToolCall | null {
        // Look for JSON block
        const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/)
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1])
                if (data.tool && data.arguments) {
                    return { name: data.tool, arguments: data.arguments }
                }
            } catch (e) {
                console.warn('Failed to parse JSON tool call', e)
            }
        }
        return null
    }

    /**
     * Execute local tool
     */
    async executeTool(call: ToolCall): Promise<string> {
        const { name, arguments: args } = call

        switch (name) {
            case 'read_file':
                return await fs.readFile(args.path, 'utf-8')

            case 'write_file':
                await fs.writeFile(args.path, args.content)
                return `Successfully wrote to ${args.path}`

            case 'list_files':
                const files = await fs.readdir(args.path || '.')
                return files.join('\n')

            case 'execute_command':
                const { stdout, stderr } = await execAsync(args.command)
                return stdout || stderr

            default:
                throw new Error(`Unknown tool: ${name}`)
        }
    }

    /**
     * Map internal tool names to Vibecraft tool types (for icons/visualization)
     */
    mapToolToVibecraftName(name: string): string {
        switch (name) {
            case 'read_file': return 'Read'
            case 'write_file': return 'Write'
            case 'list_files': return 'Glob' // or Bash
            case 'execute_command': return 'Bash'
            default: return 'Bash'
        }
    }

    /**
     * Send event to Vibecraft Server
     */
    async sendEvent(type: string, data: any) {
        const payload = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type,
            sessionId: 'session_ollama_1',
            agentId: CONFIG.agentId, // Attribution!
            cwd: process.cwd(),
            ...data
        }

        try {
            await fetch(`${CONFIG.vibecraftUrl}/api/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
        } catch (e) {
            // Ignore connection errors (server might be down, worker still works)
        }
    }
}

// CLI Entrypoint
async function main() {
    const goal = process.argv[2]
    if (!goal) {
        console.error('Please provide a goal as an argument.')
        console.error('Example: npm run ollama:worker "List files in src directory"')
        process.exit(1)
    }

    const worker = new OllamaWorker()
    await worker.start(goal)
}

main().catch(console.error)
