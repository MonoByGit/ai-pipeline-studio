"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeStatus = "waiting" | "active" | "done" | "error";

interface StepState {
  status: NodeStatus;
  result?: string;
  parsed?: Record<string, unknown> | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  {
    id: "analysis",
    number: "01",
    name: "Input Analysis",
    description: "Type, tone, urgency & intent",
  },
  {
    id: "entities",
    number: "02",
    name: "Entity Extraction",
    description: "Names, companies, dates & topics",
  },
  {
    id: "problem",
    number: "03",
    name: "Problem Identification",
    description: "Core business problem",
  },
  {
    id: "insights",
    number: "04",
    name: "Insight Generation",
    description: "Patterns, risks & opportunities",
  },
  {
    id: "actions",
    number: "05",
    name: "Action Recommendation",
    description: "Concrete next steps",
  },
];

const PRESETS = [
  {
    label: "Customer complaint",
    text: `I've been a customer for 3 years and I'm absolutely furious. My order #87234 was supposed to arrive on Monday and it's now Thursday. I called customer support twice and got different answers each time. One agent said it was delayed due to warehouse issues, another said it was already delivered. I have a tracking number that shows it's still in transit. I need this resolved TODAY or I'm canceling my subscription and disputing the charge with my bank.`,
  },
  {
    label: "Sales email",
    text: `Hi Sarah, following up on our conversation at SaaStr last week. We spoke briefly about your team's challenges with manual data entry across your CRM and billing systems. I mentioned that Flowmatic has helped similar SaaS companies like Notion and Airtable reduce operational overhead by 60%. Given that you're scaling from 50 to 200 people this year, I think the timing is right. Would you have 30 minutes for a quick demo this week? I have Thursday 2pm or Friday 10am available.`,
  },
  {
    label: "Product feedback",
    text: `The new dashboard redesign has some major usability issues. The analytics tab is now 4 clicks deep when it used to be on the home screen. Our whole team uses it every morning and this is slowing us down significantly. Also the export button moved and half the time I can't find it. I understand you're trying to clean things up but you've hidden the most used features. The old design wasn't pretty but it was fast. Can you at least add a way to customize the sidebar so we can pin our most used sections?`,
  },
];

const INITIAL_STEPS: StepState[] = PIPELINE_STEPS.map(() => ({
  status: "waiting",
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseResult(result: string): Record<string, unknown> | null {
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    // ignore parse errors
  }
  return null;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null)
    return JSON.stringify(value, null, 2);
  return String(value ?? "");
}

// ─── Result Renderers ────────────────────────────────────────────────────────

function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: "neutral" | "risk" | "success";
}) {
  const styles = {
    neutral: { background: "#F1EFE8", color: "#2C2C2A" },
    risk: { background: "#FCEBEB", color: "#791F1F" },
    success: { background: "#E1F5EE", color: "#085041" },
  };
  return (
    <span
      className="inline-flex items-center shrink-0 whitespace-nowrap rounded-full text-[11px] font-medium"
      style={{ ...styles[variant], padding: "3px 8px", borderRadius: "99px" }}
    >
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block text-[10px] font-medium uppercase tracking-widest mb-1"
      style={{ color: "#B4B2A9", letterSpacing: "0.08em" }}
    >
      {children}
    </span>
  );
}

function StepOutput({
  stepIndex,
  data,
}: {
  stepIndex: number;
  data: Record<string, unknown>;
}) {
  // Step 0: Input Analysis
  if (stepIndex === 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "type", label: "Type" },
          { key: "tone", label: "Tone" },
          { key: "urgency", label: "Urgency" },
          { key: "intent", label: "Intent" },
        ].map(({ key, label }) =>
          data[key] !== undefined ? (
            <div
              key={key}
              className={key === "intent" ? "col-span-2" : "col-span-1"}
            >
              <FieldLabel>{label}</FieldLabel>
              {key === "urgency" ? (
                <div className="flex flex-col gap-1">
                  <div>
                    <Badge
                      variant={
                        String(data[key]).toLowerCase() === "high"
                          ? "risk"
                          : String(data[key]).toLowerCase() === "low"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {String(data[key])}
                    </Badge>
                  </div>
                  {!!data.urgency_reason && (
                    <p className="text-[11px] leading-relaxed" style={{ color: "#888780", overflowWrap: "break-word" }}>
                      {String(data.urgency_reason)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed" style={{ color: "#2C2C2A", overflowWrap: "break-word" }}>
                  {formatValue(data[key])}
                </p>
              )}
            </div>
          ) : null
        )}
      </div>
    );
  }

  // Step 1: Entity Extraction
  if (stepIndex === 1) {
    const entityKeys = ["people", "companies", "dates", "amounts", "topics"];
    return (
      <div className="space-y-3">
        {entityKeys.map((key) => {
          const value = data[key];
          if (!Array.isArray(value)) return null;
          return (
            <div key={key}>
              <FieldLabel>{key}</FieldLabel>
              <div className="flex flex-wrap gap-1">
                {value.length > 0 ? (
                  value.map((item, i) => (
                    <Badge key={i}>{String(item)}</Badge>
                  ))
                ) : (
                  <span className="text-[11px]" style={{ color: "#B4B2A9" }}>
                    None found
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Step 2: Problem Identification
  if (stepIndex === 2) {
    return (
      <div className="space-y-3">
        {!!data.core_problem && (
          <div>
            <FieldLabel>Core Problem</FieldLabel>
            <p
              className="text-[13px] font-medium leading-snug"
              style={{ color: "#2C2C2A", overflowWrap: "break-word" }}
            >
              {String(data.core_problem)}
            </p>
          </div>
        )}
        {!!data.severity && (
          <div>
            <FieldLabel>Severity</FieldLabel>
            <div className="flex flex-col gap-1">
              <div>
                <Badge
                  variant={
                    String(data.severity).toLowerCase() === "critical" ||
                    String(data.severity).toLowerCase() === "high"
                      ? "risk"
                      : String(data.severity).toLowerCase() === "low"
                        ? "success"
                        : "neutral"
                  }
                >
                  {String(data.severity)}
                </Badge>
              </div>
              {!!data.severity_reason && (
                <p className="text-[11px] leading-relaxed" style={{ color: "#888780", overflowWrap: "break-word" }}>
                  {String(data.severity_reason)}
                </p>
              )}
            </div>
          </div>
        )}
        {!!data.root_cause && (
          <div>
            <FieldLabel>Root Cause</FieldLabel>
            <p className="text-[12px] leading-relaxed" style={{ color: "#2C2C2A", overflowWrap: "break-word" }}>
              {String(data.root_cause)}
            </p>
          </div>
        )}
        {!!data.affected_parties && Array.isArray(data.affected_parties) && (
          <div>
            <FieldLabel>Affected</FieldLabel>
            <div className="flex flex-wrap gap-1">
              {(data.affected_parties as string[]).map((p, i) => (
                <Badge key={i}>{String(p)}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Step 3: Insight Generation
  if (stepIndex === 3) {
    return (
      <div className="space-y-3">
        {!!data.key_insight && (
          <div>
            <FieldLabel>Key Insight</FieldLabel>
            <p
              className="text-[13px] font-medium leading-snug"
              style={{ color: "#2C2C2A", overflowWrap: "break-word" }}
            >
              {String(data.key_insight)}
            </p>
          </div>
        )}
        {!!data.risks && Array.isArray(data.risks) && (
          <div>
            <FieldLabel>Risks</FieldLabel>
            <ul className="space-y-1">
              {(data.risks as string[]).map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span
                    className="text-[11px] mt-0.5 flex-shrink-0"
                    style={{ color: "#E24B4A" }}
                  >
                    ▲
                  </span>
                  <span className="text-[12px] leading-relaxed" style={{ color: "#2C2C2A", overflowWrap: "break-word", minWidth: 0 }}>
                    {String(r)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!data.opportunities && Array.isArray(data.opportunities) && (
          <div>
            <FieldLabel>Opportunities</FieldLabel>
            <ul className="space-y-1">
              {(data.opportunities as string[]).map((o, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span
                    className="text-[11px] mt-0.5 flex-shrink-0"
                    style={{ color: "#5DCAA5" }}
                  >
                    ◆
                  </span>
                  <span className="text-[12px] leading-relaxed" style={{ color: "#2C2C2A", overflowWrap: "break-word", minWidth: 0 }}>
                    {String(o)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!data.patterns && Array.isArray(data.patterns) && (
          <div>
            <FieldLabel>Patterns</FieldLabel>
            <ul className="space-y-1">
              {(data.patterns as string[]).map((p, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-[11px] mt-0.5 flex-shrink-0" style={{ color: "#888780" }}>
                    —
                  </span>
                  <span className="text-[12px] leading-relaxed" style={{ color: "#2C2C2A", overflowWrap: "break-word", minWidth: 0 }}>
                    {String(p)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Step 4: Action Recommendation
  if (stepIndex === 4) {
    return (
      <div className="space-y-3">
        {!!data.priority && (
          <div>
            <FieldLabel>Priority</FieldLabel>
            <Badge
              variant={
                String(data.priority).toLowerCase() === "critical" ||
                String(data.priority).toLowerCase() === "high"
                  ? "risk"
                  : String(data.priority).toLowerCase() === "low"
                    ? "success"
                    : "neutral"
              }
            >
              {String(data.priority)}
            </Badge>
            {!!data.owner && (
              <span className="ml-2 text-[11px]" style={{ color: "#888780" }}>
                Owner: {String(data.owner)}
              </span>
            )}
          </div>
        )}
        {!!data.immediate && Array.isArray(data.immediate) && (
          <div>
            <FieldLabel>Immediate (24h)</FieldLabel>
            <ul className="space-y-1">
              {(data.immediate as string[]).map((action, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="text-[11px] mt-0.5 flex-shrink-0 font-medium"
                    style={{ color: "#5DCAA5" }}
                  >
                    ✓
                  </span>
                  <span className="text-[12px] leading-relaxed" style={{ color: "#2C2C2A", overflowWrap: "break-word", minWidth: 0 }}>
                    {String(action)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!data.short_term && Array.isArray(data.short_term) && (
          <div>
            <FieldLabel>This Week</FieldLabel>
            <ul className="space-y-1">
              {(data.short_term as string[]).map((action, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="text-[11px] mt-0.5 flex-shrink-0"
                    style={{ color: "#B4B2A9" }}
                  >
                    ○
                  </span>
                  <span className="text-[12px] leading-relaxed" style={{ color: "#2C2C2A", overflowWrap: "break-word", minWidth: 0 }}>
                    {String(action)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!data.success_metric && (
          <div>
            <FieldLabel>Success Metric</FieldLabel>
            <p className="text-[12px] leading-relaxed" style={{ color: "#888780", overflowWrap: "break-word" }}>
              {String(data.success_metric)}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Fallback: generic key-value
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <FieldLabel>{key.replace(/_/g, " ")}</FieldLabel>
          {Array.isArray(value) ? (
            <div className="flex flex-wrap gap-1">
              {value.length > 0 ? (
                value.map((item, i) => <Badge key={i}>{String(item)}</Badge>)
              ) : (
                <span className="text-[11px]" style={{ color: "#B4B2A9" }}>
                  None
                </span>
              )}
            </div>
          ) : (
            <p className="text-[12px]" style={{ color: "#2C2C2A" }}>
              {formatValue(value)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Pipeline Node ────────────────────────────────────────────────────────────

function PipelineNode({
  step,
  index,
  state,
}: {
  step: (typeof PIPELINE_STEPS)[0];
  index: number;
  state: StepState;
}) {
  const { status, result } = state;
  const parsed = result ? parseResult(result) : null;

  const nodeStyle =
    status === "active"
      ? {
          background: "#E6F1FB",
          borderColor: "#85B7EB",
          borderWidth: "1px",
        }
      : status === "done"
        ? {
            background: "#E1F5EE",
            borderColor: "#5DCAA5",
            borderWidth: "1px",
          }
        : status === "error"
          ? {
              background: "#FDE8E8",
              borderColor: "#E24B4A",
              borderWidth: "0.5px",
            }
          : {
              background: "#FFFFFF",
              borderColor: "#D3D1C7",
              borderWidth: "0.5px",
            };

  const labelColor =
    status === "active"
      ? "#0C447C"
      : status === "done"
        ? "#085041"
        : status === "error"
          ? "#E24B4A"
          : "#888780";

  const numberColor =
    status === "active"
      ? "#85B7EB"
      : status === "done"
        ? "#5DCAA5"
        : "#D3D1C7";

  return (
    <motion.div
      className={`rounded-2xl border flex-1 min-w-0 overflow-hidden${status === "active" ? " pulse-active" : ""}`}
      style={{
        ...nodeStyle,
        borderStyle: "solid",
      }}
      layout
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Node header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[11px] font-medium tabular-nums"
            style={{ color: numberColor, letterSpacing: "-0.02em" }}
          >
            {step.number}
          </span>
          <AnimatePresence mode="wait">
            {status === "active" && (
              <motion.div
                key="spinner"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-3.5 h-3.5 rounded-full border-2 border-transparent border-t-[#85B7EB]"
                style={{
                  animation: "spin 0.8s linear infinite",
                  borderStyle: "solid",
                  borderWidth: "1.5px",
                  borderColor: "rgba(133,183,235,0.2)",
                  borderTopColor: "#85B7EB",
                }}
              />
            )}
            {status === "done" && (
              <motion.svg
                key="check"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
              >
                <circle cx="7" cy="7" r="6.5" fill="#5DCAA5" />
                <path
                  d="M4.5 7L6.5 9L9.5 5.5"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            )}
            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px]"
                style={{ color: "#E24B4A" }}
              >
                ✕
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <h3
          className="text-[13px] font-medium leading-tight mb-0.5"
          style={{ color: labelColor, letterSpacing: "-0.02em" }}
        >
          {step.name}
        </h3>
        <p className="text-[11px]" style={{ color: "#B4B2A9" }}>
          {step.description}
        </p>
      </div>

      {/* Output section */}
      <AnimatePresence>
        {(status === "done" || status === "error") && result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className="mx-4 mb-4 pt-3 min-w-0"
              style={{
                borderTop: `1px solid ${status === "error" ? "#F9CACA" : status === "done" ? "#A3E4D0" : "#D3D1C7"}`,
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              {status === "error" ? (
                <p className="text-[12px]" style={{ color: "#E24B4A" }}>
                  {result}
                </p>
              ) : parsed ? (
                <StepOutput stepIndex={index} data={parsed} />
              ) : (
                <p className="text-[12px] leading-relaxed" style={{ color: "#888780" }}>
                  {result}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Connector ────────────────────────────────────────────────────────────────

function Connector({ filled }: { filled: boolean }) {
  return (
    <div className="flex-shrink-0 flex items-start pt-[22px] px-1">
      <div className="connector-line w-6">
        <div
          className="connector-fill"
          style={{ width: filled ? "100%" : "0%" }}
        />
      </div>
      <svg
        width="5"
        height="9"
        viewBox="0 0 5 9"
        fill="none"
        className="flex-shrink-0 -ml-0.5 mt-[-4px]"
      >
        <path
          d="M0.5 1L4 4.5L0.5 8"
          stroke={filled ? "#5DCAA5" : "#D3D1C7"}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: "stroke 0.6s ease" }}
        />
      </svg>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [input, setInput] = useState("");
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runPipeline = useCallback(async (text?: string) => {
    const inputText = text ?? input;
    if (!inputText.trim() || isRunning) return;

    // Reset state
    setSteps(INITIAL_STEPS);
    setIsDone(false);
    setIsRunning(true);

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputText }),
        signal: abortRef.current.signal,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.done) {
              setIsDone(true);
              continue;
            }

            if (typeof event.step === "number") {
              setSteps((prev) => {
                const next = [...prev];
                next[event.step] = {
                  status: event.status as NodeStatus,
                  result: event.result,
                  parsed: event.result ? parseResult(event.result) : null,
                };
                return next;
              });
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Pipeline error:", err);
    } finally {
      setIsRunning(false);
    }
  }, [input, isRunning]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setSteps(INITIAL_STEPS);
    setIsRunning(false);
    setIsDone(false);
    setInput("");
  }, []);

  const handlePreset = useCallback(
    (text: string) => {
      if (isRunning) return;
      setInput(text);
      setSteps(INITIAL_STEPS);
      setIsDone(false);
    },
    [isRunning]
  );

  const completedCount = steps.filter((s) => s.status === "done" || s.status === "error").length;

  return (
    <div className="min-h-screen px-4 py-10 md:px-8 lg:px-12" style={{ background: "#FAFAF8" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex items-baseline gap-3 mb-2">
          <h1
            className="text-[22px] font-medium"
            style={{ color: "#2C2C2A", letterSpacing: "-0.04em" }}
          >
            AI Pipeline Studio
          </h1>
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "#E6F1FB", color: "#0C447C" }}
          >
            beta
          </span>
        </div>
        <p className="text-[13px]" style={{ color: "#888780" }}>
          Paste any business input and watch it flow through a chain of AI
          reasoning steps in real time.
        </p>
      </div>

      {/* ── Input Area ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "#FFFFFF",
            border: "0.5px solid #D3D1C7",
          }}
        >
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className="text-[11px] self-center mr-1"
              style={{ color: "#B4B2A9" }}
            >
              Quick start:
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.text)}
                disabled={isRunning}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                style={{
                  background: "transparent",
                  border: "0.5px solid #B4B2A9",
                  color: "#2C2C2A",
                  cursor: isRunning ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isRunning) {
                    e.currentTarget.style.background = "#F1EFE8";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isRunning}
            placeholder="Paste a customer complaint, support ticket, sales email, or product feedback..."
            rows={5}
            className="w-full resize-none outline-none text-[13px] leading-relaxed placeholder-[#B4B2A9] disabled:opacity-60"
            style={{
              background: "transparent",
              color: "#2C2C2A",
              fontFamily: "inherit",
              border: "none",
              padding: 0,
            }}
          />

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "0.5px solid #EBE9E1" }}>
            <div className="flex items-center gap-2">
              {isRunning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "#85B7EB",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                  <span className="text-[12px]" style={{ color: "#888780" }}>
                    Processing step {completedCount + 1} of {PIPELINE_STEPS.length}...
                  </span>
                </motion.div>
              )}
              {isDone && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5.5" fill="#5DCAA5" />
                    <path
                      d="M3.5 6L5.5 8L8.5 4.5"
                      stroke="white"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-[12px]" style={{ color: "#085041" }}>
                    Pipeline complete
                  </span>
                </motion.div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(isDone || isRunning) && (
                <button
                  onClick={handleReset}
                  className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
                  style={{
                    background: "transparent",
                    border: "0.5px solid #B4B2A9",
                    color: "#888780",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F1EFE8";
                    e.currentTarget.style.color = "#2C2C2A";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#888780";
                  }}
                >
                  Reset
                </button>
              )}
              <button
                onClick={() => runPipeline()}
                disabled={isRunning || !input.trim()}
                className="text-[13px] font-medium px-4 py-2 rounded-lg transition-all"
                style={{
                  background: isRunning || !input.trim() ? "#B4B2A9" : "#185FA5",
                  color: "#E6F1FB",
                  border: "none",
                  cursor: isRunning || !input.trim() ? "not-allowed" : "pointer",
                  opacity: isRunning ? 0.7 : 1,
                }}
              >
                {isRunning ? "Running..." : "Run Pipeline"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pipeline Visualization ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto">
        {/* Desktop: horizontal pipeline */}
        <div className="hidden lg:flex items-start gap-0">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.id} className="flex items-start flex-1 min-w-0">
              <PipelineNode step={step} index={i} state={steps[i]} />
              {i < PIPELINE_STEPS.length - 1 && (
                <Connector filled={steps[i].status === "done"} />
              )}
            </div>
          ))}
        </div>

        {/* Mobile: vertical stack */}
        <div className="lg:hidden flex flex-col gap-2">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.id}>
              <PipelineNode step={step} index={i} state={steps[i]} />
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="flex flex-col items-center gap-0">
                    <div
                      className="w-px"
                      style={{
                        height: "16px",
                        background:
                          steps[i].status === "done" ? "#5DCAA5" : "#D3D1C7",
                        transition: "background 0.6s ease",
                      }}
                    />
                    <svg width="9" height="6" viewBox="0 0 9 6" fill="none">
                      <path
                        d="M1 0.5L4.5 4L8 0.5"
                        stroke={
                          steps[i].status === "done" ? "#5DCAA5" : "#D3D1C7"
                        }
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transition: "stroke 0.6s ease" }}
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mt-12">
        <p
          className="text-[11px] text-center"
          style={{ color: "#B4B2A9" }}
        >
          Powered by Claude claude-sonnet-4-20250514 · Each node is a separate AI call · No data stored
        </p>
      </div>

      {/* Spinner keyframe via style tag */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
