import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Zap, BrainCircuit, X } from 'lucide-react';

export function VoiceHUD({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [status, setStatus] = useState<'IDLE' | 'LISTENING' | 'PROCESSING' | 'EXECUTING'>('IDLE');
    const [transcript, setTranscript] = useState('');
    const [intent, setIntent] = useState<any>(null);

    // Mock voice loop trigger
    const startListening = async () => {
        setStatus('LISTENING');
        setTranscript('');
        setIntent(null);

        // Simulate voice capture
        setTimeout(async () => {
            setStatus('PROCESSING');
            try {
                const res = await fetch('/api/voice/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ context: 'pipboy' })
                });
                const data = await res.json();

                if (data.ok) {
                    setTranscript(data.transcript);
                    setIntent(data.intent);
                    setStatus('EXECUTING');

                    // Auto-close after successful execution
                    setTimeout(onClose, 3000);
                }
            } catch (e) {
                console.error("Voice processing failed", e);
                setStatus('IDLE');
            }
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-x-4 top-16 z-[2000] animate-in slide-in-from-top duration-300">
            <div className="bg-[#1a1a20]/95 border border-cyan-500/30 backdrop-blur-xl rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-2 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-cyan-400" />
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-tighter">Sovereign Voice HUD</span>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/5 rounded p-0.5 transition">
                        <X className="w-3 h-3 text-white/30" />
                    </button>
                </div>

                {/* Main Content */}
                <div className="p-4 flex flex-col items-center gap-6">
                    {/* Visualizer Circle */}
                    <div className={`relative w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${status === 'LISTENING' ? 'border-cyan-500 scale-110 shadow-[0_0_20px_rgba(6,182,212,0.5)]' :
                            status === 'PROCESSING' ? 'border-amber-500 animate-pulse' :
                                status === 'EXECUTING' ? 'border-green-500 scale-105' : 'border-white/10'
                        }`}>
                        {status === 'LISTENING' ? (
                            <Mic className="w-8 h-8 text-cyan-400 animate-bounce" />
                        ) : status === 'PROCESSING' ? (
                            <BrainCircuit className="w-8 h-8 text-amber-500 animate-spin" />
                        ) : status === 'EXECUTING' ? (
                            <Zap className="w-8 h-8 text-green-500" />
                        ) : (
                            <MicOff onClick={startListening} className="w-8 h-8 text-white/20 cursor-pointer hover:text-white/40 transition" />
                        )}

                        {/* Ripple circles if listening */}
                        {status === 'LISTENING' && (
                            <>
                                <div className="absolute inset-0 rounded-full border border-cyan-500/50 animate-ping opacity-20" />
                                <div className="absolute inset-[-10px] rounded-full border border-cyan-500/20 animate-ping opacity-10 [animation-delay:200ms]" />
                            </>
                        )}
                    </div>

                    {/* Feedback Text */}
                    <div className="w-full text-center space-y-1">
                        <div className="text-[9px] uppercase font-bold tracking-[0.2em] text-cyan-500/50">
                            {status === 'IDLE' ? 'Awaiting Directive' : status}
                        </div>
                        <div className="text-[13px] text-white font-medium min-h-[1.5em] italic">
                            {transcript || (status === 'LISTENING' ? "Listening for command..." : "")}
                        </div>
                    </div>

                    {/* Intent Preview */}
                    {intent && (
                        <div className="w-full bg-white/5 rounded p-2 border border-white/5 animate-in slide-in-from-bottom duration-500">
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-2.5 h-2.5 text-green-500" />
                                <span className="text-[8px] text-green-500 font-bold uppercase tracking-widest">Intent Decoded</span>
                            </div>
                            <div className="text-[10px] text-white/80">
                                <span className="text-white/40 uppercase text-[8px] mr-2">Action:</span>
                                {intent.action}
                            </div>
                            <div className="text-[10px] text-white/80">
                                <span className="text-white/40 uppercase text-[8px] mr-2">Target:</span>
                                {intent.target}
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Footer */}
                {status === 'IDLE' && (
                    <button
                        onClick={startListening}
                        className="w-full py-3 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest transition border-t border-cyan-500/20"
                    >
                        Engage Neural Uplink
                    </button>
                )}
            </div>
        </div>
    );
}
