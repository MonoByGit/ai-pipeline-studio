import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface StepConfig {
  name: string;
  buildPrompt: (input: string, context: string) => string;
}

const PIPELINE_STEPS: StepConfig[] = [
  {
    name: "Input Analysis",
    buildPrompt: (input: string) => `Analyze this business input and return ONLY a JSON object (no markdown, no code blocks, just raw JSON).

Input: "${input}"

Return exactly this structure:
{
  "type": "the input type (e.g. customer complaint, support ticket, product feedback, sales email)",
  "tone": "emotional tone (e.g. frustrated, neutral, positive, urgent, professional)",
  "urgency": "high, medium, or low",
  "urgency_reason": "brief reason for urgency level",
  "intent": "what the sender is trying to achieve in one sentence"
}`,
  },
  {
    name: "Entity Extraction",
    buildPrompt: (input: string, context: string) => `Extract key entities from this business input and return ONLY a JSON object (no markdown, no code blocks, just raw JSON).

Input: "${input}"
Previous analysis: ${context}

Return exactly this structure:
{
  "people": ["array of person names mentioned, or empty array"],
  "companies": ["array of company or organization names, or empty array"],
  "dates": ["array of dates or timeframes mentioned, or empty array"],
  "amounts": ["array of monetary amounts or numbers mentioned, or empty array"],
  "topics": ["array of 3-5 key topics or themes"]
}`,
  },
  {
    name: "Problem Identification",
    buildPrompt: (input: string, context: string) => `Identify the core business problem in this input and return ONLY a JSON object (no markdown, no code blocks, just raw JSON).

Input: "${input}"
Context from previous steps: ${context}

Return exactly this structure:
{
  "core_problem": "one clear sentence describing the main problem",
  "root_cause": "what likely caused this problem",
  "affected_parties": ["who is affected - e.g. customer, business, team"],
  "severity": "critical, high, medium, or low",
  "severity_reason": "brief explanation of severity rating"
}`,
  },
  {
    name: "Insight Generation",
    buildPrompt: (input: string, context: string) => `Generate strategic business insights from this input and return ONLY a JSON object (no markdown, no code blocks, just raw JSON).

Input: "${input}"
Context from previous steps: ${context}

Return exactly this structure:
{
  "key_insight": "the single most important insight in one sentence",
  "patterns": ["2-3 patterns or trends this input reveals"],
  "risks": ["1-2 business risks identified"],
  "opportunities": ["1-2 opportunities this situation reveals"]
}`,
  },
  {
    name: "Action Recommendation",
    buildPrompt: (input: string, context: string) => `Recommend concrete actions for a business team and return ONLY a JSON object (no markdown, no code blocks, just raw JSON).

Input: "${input}"
Context from previous steps: ${context}

Return exactly this structure:
{
  "immediate": ["2-3 actions to take within 24 hours"],
  "short_term": ["2-3 actions to take within 1 week"],
  "owner": "suggested team or role responsible (e.g. Customer Success, Product Team, Sales)",
  "priority": "critical, high, medium, or low",
  "success_metric": "how to measure if the response was successful"
}`,
  },
];

export async function POST(request: Request) {
  const { input } = await request.json();

  if (!input || typeof input !== "string" || input.trim().length === 0) {
    return Response.json({ error: "Input is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let context = "";

      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        const step = PIPELINE_STEPS[i];

        send({ step: i, status: "active" });

        try {
          const prompt = step.buildPrompt(input, context);

          const message = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          });

          const result =
            message.content[0].type === "text" ? message.content[0].text : "";

          context += `\n[${step.name}]: ${result}`;

          send({ step: i, status: "done", result });
        } catch (error) {
          const errMsg =
            error instanceof Error ? error.message : "Processing failed";
          send({ step: i, status: "error", result: errMsg });
          // Continue to next step even if one fails
        }
      }

      send({ done: true });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
