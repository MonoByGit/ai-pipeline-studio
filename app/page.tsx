"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

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

// ─── Mobile Gate ──────────────────────────────────────────────────────────────

function MobileGate() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "#F5F4F0" }}
    >
      <div
        className="w-full rounded-2xl p-8 text-center"
        style={{
          background: "#FFFFFF",
          border: "0.5px solid #D3D1C7",
          maxWidth: "340px",
        }}
      >
        {/* App name */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span
            className="text-[17px] font-medium"
            style={{ color: "#2C2C2A", letterSpacing: "-0.03em" }}
          >
            AI Pipeline Studio
          </span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: "#E6F1FB", color: "#0C447C" }}
          >
            beta
          </span>
        </div>

        {/* Desktop illustration */}
        <div className="flex justify-center mb-8">
          <svg
            width="80"
            height="60"
            viewBox="0 0 80 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="1"
              y="1"
              width="78"
              height="47"
              rx="5"
              stroke="#D3D1C7"
              strokeWidth="1.5"
              fill="#F5F4F0"
            />
            <rect
              x="8"
              y="8"
              width="64"
              height="33"
              rx="2.5"
              fill="#E6F1FB"
              stroke="#85B7EB"
              strokeWidth="0.5"
            />
            {/* Pipeline dots */}
            <circle cx="20" cy="24" r="5" fill="#5DCAA5" opacity="0.5" />
            <circle cx="34" cy="24" r="5" fill="#85B7EB" opacity="0.5" />
            <circle cx="48" cy="24" r="5" fill="#85B7EB" opacity="0.3" />
            <circle cx="62" cy="24" r="5" fill="#D3D1C7" opacity="0.6" />
            {/* Connectors */}
            <line x1="25" y1="24" x2="29" y2="24" stroke="#D3D1C7" strokeWidth="1" />
            <line x1="39" y1="24" x2="43" y2="24" stroke="#D3D1C7" strokeWidth="1" />
            <line x1="53" y1="24" x2="57" y2="24" stroke="#D3D1C7" strokeWidth="1" />
            {/* Stand */}
            <rect x="32" y="48" width="16" height="5" rx="0.5" fill="#D3D1C7" />
            <rect x="24" y="53" width="32" height="3.5" rx="1.75" fill="#D3D1C7" />
          </svg>
        </div>

        {/* Message */}
        <p
          className="text-[14px] leading-relaxed mb-8"
          style={{ color: "#2C2C2A" }}
        >
          AI Pipeline Studio works best on a larger screen. For the full
          experience, open this on your desktop or laptop.
        </p>

        {/* Divider */}
        <div
          style={{
            height: "0.5px",
            background: "#EBE9E1",
            marginBottom: "16px",
          }}
        />

        {/* Credit */}
        <p className="text-[11px]" style={{ color: "#B4B2A9" }}>
          Built by{" "}
          <a
            href="#"
            style={{ color: "#888780", textDecoration: "underline", textUnderlineOffset: "2px" }}
          >
            Dusty Baars
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type WizardStep = "input" | "processing" | "results";

export default function Home() {
  const [input, setInput] = useState("");
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("input");
  const [isMobile, setIsMobile] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Auto-advance to results when pipeline completes ───────────────────────
  useEffect(() => {
    if (isDone && wizardStep === "processing") {
      const delay = prefersReducedMotion ? 0 : 500;
      const t = setTimeout(() => setWizardStep("results"), delay);
      return () => clearTimeout(t);
    }
  }, [isDone, wizardStep, prefersReducedMotion]);

  // ── Pipeline runner (API logic unchanged) ─────────────────────────────────
  const runPipeline = useCallback(
    async (text?: string) => {
      const inputText = text ?? input;
      if (!inputText.trim() || isRunning) return;

      // Transition to Step 2 and reset state
      setSteps(INITIAL_STEPS);
      setIsDone(false);
      setIsRunning(true);
      setWizardStep("processing");

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
    },
    [input, isRunning]
  );

  // ── Reset (returns to Step 1) ──────────────────────────────────────────────
  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setSteps(INITIAL_STEPS);
    setIsRunning(false);
    setIsDone(false);
    setInput("");
    setWizardStep("input");
  }, []);

  // ── Preset quick-fill (no auto-run) ───────────────────────────────────────
  const handlePreset = useCallback(
    (text: string) => {
      if (isRunning) return;
      setInput(text);
      setSteps(INITIAL_STEPS);
      setIsDone(false);
    },
    [isRunning]
  );

  // ── PDF export via print ───────────────────────────────────────────────────
  const handleExportPDF = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    const originalTitle = document.title;
    document.title = `pipeline-report-${today}`;
    window.print();
    document.title = originalTitle;
  }, []);

  const completedCount = steps.filter(
    (s) => s.status === "done" || s.status === "error"
  ).length;

  // ── Mobile gate ───────────────────────────────────────────────────────────
  if (isMobile) return <MobileGate />;

  // ── Shared motion config ──────────────────────────────────────────────────
  const fadeIn = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } };

  const fadeOut = prefersReducedMotion
    ? {}
    : { exit: { opacity: 0, transition: { duration: 0.2 } } };

  return (
    <div style={{ background: "#F5F4F0", minHeight: "100vh" }}>
      <AnimatePresence mode="wait">

        {/* ━━━━━━━━━━━━━━━━━━ STEP 1: INPUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {wizardStep === "input" && (
          <motion.div
            key="input-screen"
            {...fadeIn}
            {...fadeOut}
          >
            <div
              style={{
                maxWidth: "1100px",
                margin: "0 auto",
                padding: "48px 32px",
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: "40px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                    marginBottom: "8px",
                  }}
                >
                  <h1
                    style={{
                      fontSize: "22px",
                      fontWeight: 500,
                      color: "#2C2C2A",
                      letterSpacing: "-0.04em",
                      margin: 0,
                    }}
                  >
                    AI Pipeline Studio
                  </h1>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: "99px",
                      background: "#E6F1FB",
                      color: "#0C447C",
                    }}
                  >
                    beta
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "#888780", margin: 0 }}>
                  Paste any business input and watch it flow through a chain of
                  AI reasoning steps in real time.
                </p>
              </div>

              {/* Input card */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "0.5px solid #D3D1C7",
                  borderRadius: "16px",
                  padding: "24px",
                  marginBottom: "40px",
                }}
              >
                {/* Preset buttons */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "20px",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#B4B2A9",
                      marginRight: "4px",
                    }}
                  >
                    Quick start:
                  </span>
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handlePreset(preset.text)}
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        padding: "6px 12px",
                        borderRadius: "8px",
                        background: "transparent",
                        border: "0.5px solid #B4B2A9",
                        color: "#2C2C2A",
                        cursor: "pointer",
                        transition: "background 150ms",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#F1EFE8";
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
                  placeholder={
                    "Paste a customer complaint, support ticket, sales email, or product feedback here...\n\nExamples:\n— An angry customer email about a delayed order\n— A sales pitch following up after a conference\n— Post-launch product feedback from a power user"
                  }
                  style={{
                    width: "100%",
                    minHeight: "220px",
                    resize: "vertical",
                    outline: "none",
                    fontSize: "13px",
                    lineHeight: "1.7",
                    color: "#2C2C2A",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    boxSizing: "border-box",
                  }}
                />

                {/* Run button row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "20px",
                    paddingTop: "16px",
                    borderTop: "0.5px solid #EBE9E1",
                  }}
                >
                  <button
                    onClick={() => runPipeline()}
                    disabled={!input.trim()}
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      padding: "8px 18px",
                      borderRadius: "8px",
                      background: !input.trim() ? "#E8E6DF" : "#185FA5",
                      color: !input.trim() ? "#B4B2A9" : "#E6F1FB",
                      border: "none",
                      cursor: !input.trim() ? "not-allowed" : "pointer",
                      transition: "background 150ms, color 150ms",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Run Pipeline →
                  </button>
                </div>
              </div>

              {/* Static preview — nodes in waiting state */}
              <div>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#B4B2A9",
                    marginBottom: "14px",
                    letterSpacing: "0.04em",
                  }}
                >
                  PIPELINE PREVIEW — 5 AI PROCESSING STEPS
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    overflow: "hidden",
                  }}
                >
                  {PIPELINE_STEPS.map((step, i) => (
                    <div
                      key={step.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <PipelineNode
                        step={step}
                        index={i}
                        state={INITIAL_STEPS[i]}
                      />
                      {i < PIPELINE_STEPS.length - 1 && (
                        <Connector filled={false} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━ STEP 2: PROCESSING ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {wizardStep === "processing" && (
          <motion.div
            key="processing-screen"
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3 }}
          >
            <div
              style={{
                maxWidth: "1100px",
                margin: "0 auto",
                padding: "48px 32px",
              }}
            >
              {/* Header with progress */}
              <div style={{ marginBottom: "40px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <h1
                    style={{
                      fontSize: "22px",
                      fontWeight: 500,
                      color: "#2C2C2A",
                      letterSpacing: "-0.04em",
                      margin: 0,
                    }}
                  >
                    AI Pipeline Studio
                  </h1>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: "99px",
                      background: "#E6F1FB",
                      color: "#0C447C",
                    }}
                  >
                    beta
                  </span>
                </div>

                {/* Progress line */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#85B7EB",
                      flexShrink: 0,
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "#888780" }}>
                    {completedCount === PIPELINE_STEPS.length
                      ? "Finishing up..."
                      : `Analyzing your input — step ${completedCount + 1} of ${PIPELINE_STEPS.length}`}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "#B4B2A9",
                      marginLeft: "2px",
                    }}
                  >
                    {completedCount}/{PIPELINE_STEPS.length}
                  </span>
                </div>
              </div>

              {/* Pipeline nodes — staggered fade-in */}
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                {PIPELINE_STEPS.map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={
                      prefersReducedMotion
                        ? undefined
                        : { opacity: 0, y: 12 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      prefersReducedMotion
                        ? {}
                        : {
                            delay: i * 0.1,
                            duration: 0.4,
                            ease: [0.4, 0, 0.2, 1],
                          }
                    }
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <PipelineNode step={step} index={i} state={steps[i]} />
                    {i < PIPELINE_STEPS.length - 1 && (
                      <Connector filled={steps[i].status === "done"} />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━ STEP 3: RESULTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {wizardStep === "results" && (
          <motion.div
            key="results-screen"
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ minHeight: "100vh" }}
          >
            {/* Sticky header bar */}
            <motion.div
              initial={prefersReducedMotion ? undefined : { y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={
                prefersReducedMotion
                  ? {}
                  : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
              }
              className="print-hide"
              style={{
                background: "#FFFFFF",
                borderBottom: "0.5px solid #D3D1C7",
                position: "sticky",
                top: 0,
                zIndex: 20,
                padding: "14px 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Title */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "#2C2C2A",
                    letterSpacing: "-0.03em",
                  }}
                >
                  AI Pipeline Studio
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 500,
                    padding: "2px 6px",
                    borderRadius: "99px",
                    background: "#E6F1FB",
                    color: "#0C447C",
                  }}
                >
                  beta
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#B4B2A9",
                    marginLeft: "6px",
                  }}
                >
                  — Analysis complete
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={handleExportPDF}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "7px 16px",
                    borderRadius: "8px",
                    background: "#185FA5",
                    color: "#E6F1FB",
                    border: "none",
                    cursor: "pointer",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Export PDF
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "7px 16px",
                    borderRadius: "8px",
                    background: "transparent",
                    border: "0.5px solid #B4B2A9",
                    color: "#888780",
                    cursor: "pointer",
                    letterSpacing: "-0.01em",
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
                  Start over
                </button>
              </div>
            </motion.div>

            {/* Results body */}
            <div
              style={{
                maxWidth: "1100px",
                margin: "0 auto",
                padding: "40px 32px 80px",
              }}
            >
              {/* Print-only cover line */}
              <div id="print-header" style={{ display: "none", marginBottom: "32px" }}>
                <h1
                  style={{
                    fontSize: "18px",
                    fontWeight: 500,
                    color: "#2C2C2A",
                    letterSpacing: "-0.03em",
                    margin: "0 0 4px",
                  }}
                >
                  AI Pipeline Studio — Analysis Report
                </h1>
                <p style={{ fontSize: "12px", color: "#888780", margin: 0 }}>
                  {new Date().toLocaleDateString("en-GB", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              {/* Results grid: 2-col on large screens */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "16px",
                }}
                className="results-grid"
              >
                {PIPELINE_STEPS.map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={
                      prefersReducedMotion ? undefined : { opacity: 0, y: 20 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      prefersReducedMotion
                        ? {}
                        : {
                            delay: i * 0.08,
                            duration: 0.4,
                            ease: [0.4, 0, 0.2, 1],
                          }
                    }
                    style={i === 4 ? { gridColumn: "1 / -1" } : {}}
                  >
                    <PipelineNode step={step} index={i} state={steps[i]} />
                  </motion.div>
                ))}
              </div>

              {/* Start over link */}
              <div
                className="print-hide"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "56px",
                }}
              >
                <button
                  onClick={handleReset}
                  style={{
                    fontSize: "13px",
                    background: "none",
                    border: "none",
                    color: "#B4B2A9",
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#888780";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#B4B2A9";
                  }}
                >
                  ← Start over
                </button>
              </div>

              {/* Footer */}
              <p
                className="print-hide"
                style={{
                  fontSize: "11px",
                  textAlign: "center",
                  color: "#D3D1C7",
                  marginTop: "16px",
                }}
              >
                Powered by Claude claude-sonnet-4-20250514 · Each node is a
                separate AI call · No data stored
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Global keyframes + print styles ─────────────────────────────── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        /* Results grid: single column below 900px */
        @media (max-width: 900px) {
          .results-grid {
            grid-template-columns: 1fr !important;
          }
          .results-grid > *:last-child {
            grid-column: auto !important;
          }
        }

        /* Print styles */
        @media print {
          .print-hide { display: none !important; }
          #print-header { display: block !important; }
          body { background: #fff !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .results-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}
