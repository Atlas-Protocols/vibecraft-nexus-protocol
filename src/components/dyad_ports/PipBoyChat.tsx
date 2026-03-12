import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User } from 'lucide-react';
import './PipBoy.css';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export function PipBoyChat() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'system', content: 'Pip-Boy OS v1.0 Online.', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'Ready for input, Sir.', timestamp: Date.now() + 100 }
    ]);
    const endRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // Mock response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Acknowledged: "${userMsg.content}"`,
                timestamp: Date.now()
            }]);
        }, 600);
    };

    return (
        <div className="flex flex-col h-full bg-[#1a1a20] text-gray-200 font-mono text-sm">
            {/* Header */}
            <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-[#121215]">
                <Bot className="w-4 h-4 text-green-400" />
                <span className="font-bold text-green-400">secure_channel_01</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                            ${msg.role === 'user' ? 'bg-blue-900/50' : msg.role === 'assistant' ? 'bg-green-900/50' : 'bg-gray-800'}`}>
                            {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-[80%] rounded-lg p-3 
                            ${msg.role === 'user' ? 'bg-blue-900/20 border border-blue-500/30' :
                                msg.role === 'assistant' ? 'bg-green-900/20 border border-green-500/30' : 'bg-gray-800/50'}`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 bg-[#121215]">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Command stream..."
                        className="w-full bg-black/30 border border-white/10 rounded-lg py-2 pl-3 pr-10 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 transition-all"
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:text-green-400 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
