import React, { useEffect, useRef } from 'react';
import { WorkshopScene } from '../scene/WorkshopScene';

export function OSEViewer() {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<WorkshopScene | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize the real Workshop Scene
        if (!sceneRef.current) {
            console.log("Mounting WorkshopScene...");
            sceneRef.current = new WorkshopScene(containerRef.current);

            // Start the render loop
            const animate = () => {
                requestAnimationFrame(animate);
                // The scene handles its own rendering loop internally or via methods?
                // Checking WorkshopScene, it sets up its own loop or needs one?
                // Actually WorkshopScene usually sets up its own loop or is driven by main.ts
                // Let's check if it exposes a render method or if we need to drive it.
                // Looking at WorkshopScene.ts, it doesn't seem to self-drive in the constructor.
                // It has `onRenderCallbacks`.
                // Let's assume we need to drive it for now or standard THREE pattern.

                if (sceneRef.current) {
                    sceneRef.current.controls.update();
                    sceneRef.current.renderer.render(
                        sceneRef.current.scene,
                        sceneRef.current.camera
                    );
                }
            };
            animate();
        }

        return () => {
            // Cleanup if necessary
            // sceneRef.current?.dispose(); // If dispose exists
        };
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0 w-full h-full bg-black" />
    );
}
