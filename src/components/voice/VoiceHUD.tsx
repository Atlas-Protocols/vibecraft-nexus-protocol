import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Zap, Brain, Activity } from 'lucide-react';
import './VoiceHUD.css';

export function VoiceHUD() {
    const [isListening, setIsListening] = useState(false);
    const [voiceLevel, setVoiceLevel] = useState(0);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const toggleListening = async () => {
        if (!isListening) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContextRef.current = new AudioContext();
                const source = audioContextRef.current.createMediaStreamSource(stream);
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;
                source.connect(analyserRef.current);

                setIsListening(true);
                startAnalysis();

                // ZENITH: Trigger backend processing
                const response = await fetch('/api/voice/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ context: 'pipboy' })
                });

                const data = await response.json();
                if (data.ok) {
                    setIsProcessing(true);
                    setTimeout(() => {
                        setTranscript(data.transcript);
                        setIsProcessing(false);
                    }, 1000); // Aesthetic delay
                }
            } catch (err) {
                console.error('Mic access denied:', err);
            }
        } else {
            stopListening();
        }
    };

    const stopListening = () => {
        setIsListening(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        setVoiceLevel(0);
    };

    const startAnalysis = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const update = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((prev, curr) => prev + curr, 0) / dataArray.length;
            setVoiceLevel(average / 128); // Normalize to 0-2 range
            animationFrameRef.current = requestAnimationFrame(update);
        };
        update();
    };

    return (
        <div className="voice-hud">
            {/* Visualizer Ring */}
            <div
                className={`voice-ring ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}
                style={{ transform: `scale(${1 + voiceLevel * 0.5})`, opacity: 0.5 + voiceLevel * 0.5 }}
            />

            {/* Core Interaction Sphere */}
            <div
                className={`voice-orb ${isListening ? 'active' : ''}`}
                onClick={toggleListening}
            >
                {isProcessing ? (
                    <Activity className="animate-spin text-purple-400" />
                ) : isListening ? (
                    <Mic className="text-green-400" />
                ) : (
                    <MicOff className="text-gray-500" />
                )}
            </div>

            {/* Status & Transcript Overlay */}
            {(isListening || isProcessing) && (
                <div className="voice-overlay px-4 py-2 bg-black/80 backdrop-blur-md rounded-full border border-white/20 mt-4 flex items-center gap-3">
                    <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="w-1 h-3 bg-purple-500 rounded-full animate-pulse"
                                style={{ animationDelay: `${i * 0.2}s` }}
                            />
                        ))}
                    </div>
                    <span className="text-xs font-mono text-purple-300 uppercase tracking-widest">
                        {isProcessing ? 'Thinking...' : 'Builder Listening...'}
                    </span>
                    {transcript && (
                        <span className="text-xs text-white/80 border-l border-white/20 pl-3">
                            "{transcript}"
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
