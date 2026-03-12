import React, { useState, useEffect } from 'react';
import { Activity, LayoutGrid, Users, Terminal, ShieldAlert } from 'lucide-react';

export function OrchestratorApp() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [skills, setSkills] = useState<any[]>([]);
    const [chatter, setChatter] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'status' | 'skills' | 'worklogs'>('status');
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [worklogContent, setWorklogContent] = useState<string>('');
    const [stats, setStats] = useState({ total_xp: 4500, active_agents: 5, system_load: '14%' });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [taskRes, skillRes, chatterRes] = await Promise.all([
                    fetch('/api/tasks/pending'),
                    fetch('/api/skills/installed'),
                    fetch('/api/skills/chatter')
                ]);
                const taskData = await taskRes.json();
                const skillData = await skillRes.json();
                const chatterData = await chatterRes.json();

                if (taskData.ok) setTasks(taskData.tasks);
                if (skillData.ok) setSkills(skillData.skills);
                if (chatterData.ok) setChatter(chatterData.messages);
            } catch (e) {
                console.error("Data fetch failed", e);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedAgent && activeTab === 'worklogs') {
            fetch(`/api/skills/worklog?agent_id=${selectedAgent}`)
                .then(res => res.json())
                .then(data => {
                    if (data.ok) setWorklogContent(data.content);
                });
        }
    }, [selectedAgent, activeTab]);

    const renderTasks = (parent_id: string | null = null, depth = 0) => {
        return tasks
            .filter(t => t.parent_id === parent_id)
            .map((task, i) => (
                <div key={task.id} style={{ marginLeft: `${depth * 12}px` }} className={`p-2 bg-white/5 rounded border-l-2 ${depth > 0 ? 'border-amber-500/50 mt-1 opacity-80' : 'border-cyan-500'} mb-1.5`}>
                    <div className="flex items-center gap-2">
                        <span className="opacity-30 text-[8px]">{depth > 0 ? '↳' : `0${i + 1}`}</span>
                        <div className="flex-1 min-w-0">
                            <div className="truncate text-white/90 text-[10px]">{task.description}</div>
                            <div className="flex gap-2 mt-0.5">
                                <span className="text-[7px] px-1 bg-white/5 text-gray-500 rounded uppercase font-bold">{task.assigned_to}</span>
                                <span className={`text-[7px] px-1 rounded uppercase ${task.status === 'in_progress' ? 'bg-amber-500/20 text-amber-500' : 'bg-cyan-500/10 text-cyan-400'}`}>
                                    {task.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    {renderTasks(task.id, depth + 1)}
                </div>
            ));
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0f] text-gray-300 font-mono text-[11px] overflow-hidden">
            {/* Header / Status Bar */}
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span className="font-bold tracking-tighter text-cyan-500 uppercase">Orchestrator v1.1</span>
                </div>
                <div className="flex gap-3">
                    <span className="text-[9px] text-green-500 font-bold">CADRE_SYNCED</span>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-white/5 bg-white/[0.01]">
                {['status', 'skills', 'worklogs'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-2 text-[8px] font-bold uppercase tracking-widest transition ${activeTab === tab ? 'text-cyan-400 border-b border-cyan-500 bg-cyan-500/5' : 'text-white/30 hover:text-white/60'}`}
                    >
                        {tab === 'status' ? 'System Status' : tab === 'skills' ? 'Skills Explorer' : 'Cadre Logs'}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden p-3 bg-black/20">
                {activeTab === 'status' ? (
                    <div className="h-full flex flex-col space-y-4">
                        <div className="flex-none grid grid-cols-2 gap-2">
                            {['antigravity', 'jules', 'ollama', 'ralph', 'cove'].map(agent => (
                                <div key={agent} className="p-2 bg-white/5 rounded border border-white/5 hover:border-cyan-500/30 transition cursor-pointer" onClick={() => { setSelectedAgent(agent); setActiveTab('worklogs'); }}>
                                    <div className="flex items-center justify-between">
                                        <span className="capitalize text-white/80 text-[10px]">{agent}</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    </div>
                                    <div className="text-[7px] mt-1 opacity-40 uppercase">Sovereign Active</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="flex items-center gap-2 mb-2 text-white/50 border-b border-white/5 pb-1">
                                <Terminal className="w-3 h-3" />
                                <span className="uppercase text-[9px] font-bold">Mission Threads</span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {tasks.length === 0 ? <div className="py-8 text-center opacity-20 italic">No active threads</div> : renderTasks(null)}
                            </div>
                        </div>

                        <div className="h-24 bg-black/40 border border-white/5 rounded p-2 flex flex-col">
                            <div className="text-[8px] text-cyan-500/50 uppercase font-bold mb-1">Cadre Chatter (Shared Bus)</div>
                            <div className="flex-1 overflow-y-auto text-[8px] space-y-1 custom-scrollbar">
                                {chatter.slice(-10).map((msg, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className={`font-bold transition-colors ${msg.type === 'dm' ? 'text-amber-500' : 'text-cyan-400'}`}>[{msg.from}]</span>
                                        <span className="opacity-70">{msg.content}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'skills' ? (
                    <div className="h-full overflow-y-auto space-y-2">
                        {skills.map(skill => (
                            <div key={skill.id} className="p-3 bg-white/5 rounded border border-white/10 hover:border-cyan-500/50 transition group">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-white font-bold text-[10px] uppercase">{skill.name}</span>
                                    <span className="text-[7px] px-1 bg-cyan-500/20 text-cyan-400 rounded">READY</span>
                                </div>
                                <div className="text-[8px] opacity-60 leading-snug">{skill.description}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex gap-3">
                        <div className="w-20 flex flex-col gap-1">
                            {['antigravity', 'jules', 'ollama', 'ralph', 'cove'].map(a => (
                                <button key={a} onClick={() => setSelectedAgent(a)} className={`p-1.5 text-[8px] text-left uppercase font-bold transition rounded ${selectedAgent === a ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>
                                    {a}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 bg-black/40 p-3 rounded border border-white/5 overflow-y-auto custom-scrollbar">
                            <pre className="text-[8px] leading-relaxed whitespace-pre-wrap text-emerald-500/80">
                                {worklogContent || "Select an agent to view sovereign worklogs..."}
                            </pre>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Control Prompt */}
            <div className="p-3 bg-black/40 border-t border-white/5">
                <button
                    onClick={() => (window as any).triggerVoiceHUD?.()}
                    className="w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded transition border border-cyan-500/30 font-bold uppercase tracking-widest text-[9px]"
                >
                    Initiate Global Handoff
                </button>
            </div>
        </div>
    );
}
