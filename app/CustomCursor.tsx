"use client";

import { useEffect, useRef } from "react";
import { Navigation2 } from "lucide-react";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef({ x: -100, y: -100 });
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. The animation loop updates the DOM exactly when the screen refreshes.
    const renderCursor = () => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0) translate(-50%, -2px)`;
      }
      requestRef.current = requestAnimationFrame(renderCursor);
    };
    requestRef.current = requestAnimationFrame(renderCursor);

    // 2. The mousemove event only updates the JS object, doing zero DOM work.
    const onMouseMove = (e: MouseEvent) => {
      positionRef.current.x = e.clientX;
      positionRef.current.y = e.clientY;
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !target.tagName) return;
      
      const isClickable = 
        target.tagName.toLowerCase() === "a" ||
        target.tagName.toLowerCase() === "button" ||
        target.tagName.toLowerCase() === "input" ||
        target.tagName.toLowerCase() === "textarea" ||
        target.tagName.toLowerCase() === "select" ||
        target.closest("a") !== null ||
        target.closest("button") !== null ||
        target.closest(".widget") !== null ||
        target.closest("[role='button']") !== null ||
        target.closest(".nav-item") !== null ||
        target.classList.contains("export-link");

      if (cursorRef.current) {
        if (isClickable) cursorRef.current.classList.add("hovering");
        else cursorRef.current.classList.remove("hovering");
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseover", handleMouseOver, { passive: true });

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className="custom-cursor"
      style={{
        transform: "translate3d(-100px, -100px, 0) translate(-50%, -2px)", // Start offscreen
      }}
    >
      <Navigation2 size={24} fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
    </div>
  );
}
