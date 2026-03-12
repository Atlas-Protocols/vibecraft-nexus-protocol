import { Home, Inbox, Settings, Store, BookOpen, Layers, Bot, Brain, Cpu, Zap, Mic, ShieldCheck, Activity } from 'lucide-react';
import { VoiceHUD } from '../voice/VoiceHUD';
import './PipBoy.css';

interface PipBoySidebarProps {
    activeView: string; // 'none' | 'chat' | 'apps' | 'settings' | 'agents'
    onViewChange: (view: string) => void;
    onToggleViewer: () => void; // Toggle 3D visualizer overlay
    isViewerOpen: boolean;
}

export function PipBoySidebar({ activeView, onViewChange, onToggleViewer, isViewerOpen }: PipBoySidebarProps) {
    // If activeView is not 'none', the sidebar shows the secondary panel
    const isExpanded = activeView !== 'none';

    const menuItems = [
        { id: 'agents', icon: Bot, label: 'Agents' },
        { id: 'voice', icon: Mic, label: 'Voice' }, // ✨ BUILD-BOT VOICE AI
        { id: 'apps', icon: Home, label: 'Apps' },
        { id: 'chat', icon: Inbox, label: 'Chat' },
        { id: 'library', icon: BookOpen, label: 'Files' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    const handleItemClick = (id: string) => {
        if (activeView === id) {
            onViewChange('none'); // Toggle off
        } else {
            onViewChange(id);
        }
    };

    return (
        <div className={`pipboy-sidebar ${isExpanded ? 'expanded' : ''}`}>
            {/* Main Icon Rail */}
            <div className="flex flex-col items-center w-16">
                {/* Viewer Toggle (Special) */}
                <div
                    className={`pipboy-menu-item ${isViewerOpen ? 'active' : ''}`}
                    onClick={onToggleViewer}
                    title="Toggle 3D Viewer"
                >
                    <Layers className="pipboy-icon" />
                    <span className="pipboy-label">View</span>
                </div>

                <div className="h-px w-10 bg-white/10 my-2" />

                {/* Sovereign Status Badge (HUD-side) */}
                <div className="flex flex-col items-center mb-4 opacity-70">
                    <ShieldCheck className="w-4 h-4 text-green-500 mb-1" />
                    <span className="text-[8px] text-green-500/80 font-bold uppercase">Zenith</span>
                </div>

                {menuItems.map((item) => (
                    <div
                        key={item.id}
                        className={`pipboy-menu-item ${activeView === item.id ? 'active' : ''}`}
                        onClick={() => handleItemClick(item.id)}
                    >
                        <item.icon className="pipboy-icon" />
                        <span className="pipboy-label">{item.label}</span>
                    </div>
                ))}
            </div>

            {/* Expansive Panel Content */}
            <div className="pipboy-panel">
                <div className="pipboy-panel-header flex items-center justify-between">
                    <span>{activeView === 'none' ? '' : activeView}</span>
                    {isExpanded && <Activity className="w-3 h-3 text-white/20 animate-pulse" />}
                </div>

                {/* Dynamic Content based on View */}
                {activeView === 'voice' && (
                    <div className="flex flex-col items-center justify-center h-full pb-10">
                        <VoiceHUD />
                        <div className="mt-4 text-[10px] text-center text-gray-500 px-4">
                            Phase 9: local whisper.cpp active. Say "Expand rafters" or "BOM".
                        </div>
                    </div>
                )}
                {activeView === 'chat' && (
                    <div className="text-gray-400 text-sm">
                        <div>Recent Chats</div>
                        <div className="mt-2 p-2 bg-white/5 rounded cursor-pointer hover:bg-white/10">
                            Current Session
                        </div>
                    </div>
                )}

                {activeView === 'apps' && (
                    <div className="text-gray-400 text-sm">
                        Installed Modules
                    </div>
                )}

                {/* ✨ NEW: Multi-Agent Panel */}
                {activeView === 'agents' && (
                    <div className="text-gray-300 text-sm space-y-3">
                        {/* Claude */}
                        <div className="p-2 bg-blue-500/10 rounded-lg border-l-2 border-blue-400">
                            <div className="flex items-center gap-2 mb-1">
                                <Brain className="w-4 h-4 text-blue-400" />
                                <span className="font-medium text-blue-300">Claude</span>
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Online</span>
                            </div>
                            <div className="text-xs text-gray-500">Sonnet 4.5 • General tasks</div>
                        </div>

                        {/* Antigravity */}
                        <div className="p-2 bg-purple-500/10 rounded-lg border-l-2 border-purple-400">
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-4 h-4 text-purple-400" />
                                <span className="font-medium text-purple-300">Antigravity</span>
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Active</span>
                            </div>
                            <div className="text-xs text-gray-500">Gemini • Sovereign ops</div>
                        </div>

                        {/* Ollama */}
                        <div className="p-2 bg-amber-500/10 rounded-lg border-l-2 border-amber-400">
                            <div className="flex items-center gap-2 mb-1">
                                <Cpu className="w-4 h-4 text-amber-400" />
                                <span className="font-medium text-amber-300">Ollama</span>
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Idle</span>
                            </div>
                            <div className="text-xs text-gray-500">deepseek-r1 • Local AI</div>
                        </div>

                        {/* Jules */}
                        <div className="p-2 bg-cyan-500/10 rounded-lg border-l-2 border-cyan-400">
                            <div className="flex items-center gap-2 mb-1">
                                <Bot className="w-4 h-4 text-cyan-400" />
                                <span className="font-medium text-cyan-300">Jules</span>
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Ready</span>
                            </div>
                            <div className="text-xs text-gray-500">n8n • Automation</div>
                        </div>

                        {/* Quick Actions */}
                        <div className="pt-2 border-t border-white/10 flex gap-2">
                            <button className="flex-1 px-2 py-1.5 text-xs bg-indigo-500/20 text-indigo-300 rounded hover:bg-indigo-500/30 transition">
                                Start Task
                            </button>
                            <button className="flex-1 px-2 py-1.5 text-xs bg-white/10 text-gray-400 rounded hover:bg-white/20 transition">
                                View All
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
