/**
 * Agents Module - Multi-agent system without OAuth
 *
 * Export all agent types and manager
 */

export { BaseAgent, type AgentConfig, type AgentEvent, type AgentMessage, type AgentResponse, type ToolUse } from './BaseAgent'
export { ClaudeAgent } from './ClaudeAgent'
export { OllamaAgent } from './OllamaAgent'
export { AgentManager } from './AgentManager'
