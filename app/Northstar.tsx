"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, User, Loader2, Maximize2, Minimize2, RotateCw, CornerDownLeft } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { type Weights } from "@/lib/decision";

type Message = {
  id: string;
  role: "user" | "agent";
  text: string;
  isAction?: boolean;
};

type NorthstarMode = "sidebar" | "floating" | "closed";

const SUGGESTIONS = [
  "Which market has the highest peer stress?",
  "Update my analytics to focus primarily on margin and resilience.",
  "Why is India considered a strong growth momentum bet?",
];

export default function Northstar({ weights, setWeights, initialMode = "closed" }: { weights: Weights, setWeights: (w: Weights) => void, initialMode?: NorthstarMode }) {
  const [mode, setMode] = useState<NorthstarMode>(initialMode);
  
  // Position state for floating mode
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const constraintRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    { id: "init", role: "agent", text: "Hi, I'm Northstar. I can help you analyze market trends across markets, interpret the predictive ML model, or execute automated actions via natural language to update your business priorities. Try asking me a question or clicking one of the suggestions below." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "closed") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, agentStatus, mode]);

  async function submitMessage(userMessage: string) {
    if (!userMessage.trim() || loading) return;

    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", text: userMessage }]);
    setLoading(true);
    setAgentStatus("Analyzing request...");

    try {
      setTimeout(() => setAgentStatus("Retrieving evidence via RAG..."), 800);
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, state: { weights } })
      });
      
      const data = await res.json();
      
      if (data.action === "setWeights" && data.weights) {
        setAgentStatus("Executing agentic tool: setWeights...");
        setTimeout(() => {
          setWeights(data.weights);
          setMessages(prev => [...prev, { id: Date.now().toString(), role: "agent", text: data.text || "I've updated the scenario weights.", isAction: true }]);
          setLoading(false);
          setAgentStatus("");
        }, 800);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "agent", text: data.text || "I'm sorry, I encountered an error." }]);
        setLoading(false);
        setAgentStatus("");
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "agent", text: "Connection error." }]);
      setLoading(false);
      setAgentStatus("");
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const val = input;
    setInput("");
    submitMessage(val);
  }

  const renderMessages = () => (
    <div className="northstar-messages">
      {messages.map(m => (
        <div key={m.id} className={`northstar-message ${m.role}`}>
          {m.role === 'agent' ? (
            <div className="ns-avatar agent">
              <img src="/northstar_white.png" width="16" height="16" alt="Northstar" />
            </div>
          ) : null}
          
          <div className="ns-bubble">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
          </div>
          
          {m.role === 'user' && (
            <div className="ns-avatar user">
              <User size={14} />
            </div>
          )}
        </div>
      ))}
      
      {messages.length === 1 && (
        <div className="ns-suggestions">
          {SUGGESTIONS.map(sugg => (
            <button key={sugg} className="ns-suggestion-card" onClick={() => submitMessage(sugg)}>
              <span>{sugg}</span>
              <CornerDownLeft size={14} className="ns-suggestion-icon" />
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="northstar-status">
          <img src="/northstar_teal.png" width="14" height="14" className="rhythmic-spin" alt="Loading" />
          <span>{agentStatus}</span>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  const renderInput = () => (
    <div className="northstar-input">
      <form onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Northstar a question..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? (
            <img src="/northstar_white.png" width="16" height="16" className="rhythmic-spin" alt="Loading" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 2L5 19L12 15L19 19L12 2Z" fill="currentColor" fillOpacity="0.9" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );

  return (
    <div className="northstar-container" ref={constraintRef}>
      {/* FAB Button for Closed Mode */}
      <motion.div 
        className="northstar-fab-container"
        style={{ display: mode === "closed" ? 'block' : 'none' }}
      >
        <motion.div 
          style={{
            position: 'absolute', inset: '-12px', borderRadius: '50%',
            background: 'radial-gradient(circle at center, rgba(36, 82, 91, 0.5) 0%, rgba(56, 109, 118, 0.2) 50%, transparent 80%)',
            zIndex: 0,
            pointerEvents: 'none'
          }}
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.4, 0.9, 0.4],
          }}
          transition={{
            duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse'
          }}
        />
        <motion.button
          onClick={() => setMode("sidebar")}
          className="northstar-fab"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          aria-label="Open Northstar"
          style={{ zIndex: 1 }}
        >
          <img src="/northstar_white.png" width="28" height="28" className="northstar-fab-icon" alt="Northstar" />
        </motion.button>
      </motion.div>

      {/* Floating Widget Mode */}
      {mode === "floating" && (
        <motion.div 
          ref={dragRef}
          className="northstar-floating"
          drag
          dragMomentum={false}
          dragElastic={0.2}
          dragConstraints={constraintRef}
          style={{ x: 0, y: 0 }}
        >
          <div className="northstar-header" onMouseDown={(e) => e.stopPropagation()}>
            <div className="northstar-header-title">
              <div className="northstar-header-icon">
                <img src="/northstar_teal.png" width="20" height="20" alt="Northstar" />
              </div>
              <h2>Northstar</h2>
            </div>
            <div className="northstar-header-actions">
              <button className="northstar-header-btn" onClick={() => setMode("sidebar")} title="Dock to Sidebar">
                <Maximize2 size={16} />
              </button>
              <button className="northstar-header-btn" onClick={() => setMode("closed")} title="Close">
                <X size={16} />
              </button>
            </div>
          </div>
          {renderMessages()}
          {renderInput()}
        </motion.div>
      )}

      {/* Sidebar Mode */}
      {mode === "sidebar" && (
        <div className="northstar-sidebar">
          <div className="northstar-header">
            <div className="northstar-header-title">
              <div className="northstar-header-icon">
                <img src="/northstar_teal.png" width="20" height="20" alt="Northstar" />
              </div>
              <h2>Northstar</h2>
            </div>
            <div className="northstar-header-actions">
              <button className="northstar-header-btn" onClick={() => setMode("floating")} title="Minimize to Widget">
                <Minimize2 size={16} />
              </button>
              <button className="northstar-header-btn" onClick={() => setMode("closed")} title="Close">
                <X size={16} />
              </button>
            </div>
          </div>
          {renderMessages()}
          {renderInput()}
        </div>
      )}
    </div>
  );
}
