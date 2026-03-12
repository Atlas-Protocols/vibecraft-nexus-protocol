import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { OSEViewer } from './components/OSEViewer';
import { PipBoySidebar } from './components/dyad_ports/PipBoySidebar';
import { PipBoyChat } from './components/dyad_ports/PipBoyChat';
import { MeshFilesProvider } from './contexts/MeshFilesContext';
import { OrchestratorApp } from './components/apps/OrchestratorApp';
import { VoiceHUD } from './components/apps/VoiceHUD';

console.log("Initializing OSE React Layer (Pip-Boy v1)");

function PipBoyRoot() {
    const [activeView, setActiveView] = useState('chat');
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [isVoiceOpen, setIsVoiceOpen] = useState(false);

    // Provide a way for child components to trigger voice
    (window as any).triggerVoiceHUD = () => setIsVoiceOpen(true);

    return (
        <div className="flex w-full h-full pointer-events-none">
            {/* Sidebar (Pointer events re-enabled inside) */}
            <div className="pointer-events-auto h-full flex z-[1000]">
                <PipBoySidebar
                    activeView={activeView}
                    onViewChange={setActiveView}
                    isViewerOpen={isViewerOpen}
                    onToggleViewer={() => setIsViewerOpen(!isViewerOpen)}
                />

                {/* Active Panel (Chat, etc.) */}
                {activeView !== 'none' && (
                    <div className="w-[350px] h-full bg-[#1a1a20]/95 border-r border-white/10 backdrop-blur-md flex flex-col pointer-events-auto shadow-2xl">
                        {activeView === 'chat' && <PipBoyChat />}
                        {activeView === 'apps' && <OrchestratorApp />}
                        {activeView === 'settings' && <div className="p-4 text-white">System Settings</div>}
                    </div>
                )}
            </div>

            {/* 3D Viewer Overlay (Center/Full) */}
            {isViewerOpen && (
                <div className="absolute inset-0 z-0 pointer-events-auto">
                    <div className="absolute top-4 right-4 z-50">
                        <button
                            className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-1 rounded text-sm backdrop-blur"
                            onClick={() => setIsViewerOpen(false)}
                        >
                            Close Viewer
                        </button>
                    </div>
                    <OSEViewer />
                </div>
            )}
            {/* Voice HUD Overlay */}
            <VoiceHUD isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} />
        </div>
    );
}

const rootEl = document.getElementById('ose-viewer-root');
if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(
        <React.StrictMode>
            <MeshFilesProvider>
                <PipBoyRoot />
            </MeshFilesProvider>
        </React.StrictMode>
    );
} else {
    console.error("Failed to find #ose-viewer-root");
}

// Global toggle function (Legacy support)
(window as any).toggleOSEViewer = () => {
    const el = document.getElementById('ose-viewer-root');
    if (el) el.classList.toggle('hidden');
};
