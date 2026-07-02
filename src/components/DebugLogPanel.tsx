import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import * as api from "../api";
import type { DebugLogEntry } from "../types";
import Icon from "./Icon";

const LIMIT = 1000;

export default function DebugLogPanel({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    api.debugLogs().then(setLogs).catch(() => {});
    const un = listen<DebugLogEntry>("debug-log", (event) => {
      if (pausedRef.current) return;
      setLogs((prev) => [...prev.slice(-LIMIT + 1), event.payload]);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el && !paused) el.scrollTop = el.scrollHeight;
  }, [logs, paused]);

  return (
    <div className="debug-log-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <section className="debug-log-window" onMouseDown={(e) => e.stopPropagation()}>
        <header className="debug-log-head">
          <div>
            <h2>Debug logs</h2>
            <p>{logs.length} entries</p>
          </div>
          <div className="debug-log-actions">
            <button className="s-btn" onClick={() => setPaused((v) => !v)}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button className="s-btn" onClick={() => setLogs([])}>
              Clear
            </button>
            <button className="debug-log-close" title="Close" onClick={onClose}>
              <Icon name="x" size={16} />
            </button>
          </div>
        </header>
        <div className="debug-log-list" ref={listRef}>
          {logs.map((log) => (
            <div className={`debug-log-row ${log.level.toLowerCase()}`} key={log.id}>
              <span className="debug-log-time">{log.ts}</span>
              <span className="debug-log-level">{log.level}</span>
              <span className="debug-log-target">{log.target}</span>
              <span className="debug-log-msg">{log.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
