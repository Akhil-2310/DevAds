import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL =
  process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest";

export const hasAnthropic = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type ChatTurn = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are AdFunded AI, a senior software engineering assistant in a Claude Code-style developer workspace.
- Answer coding, debugging, architecture, research, and technical-support questions.
- Use GitHub-flavored markdown. Put code in fenced blocks with a language tag.
- Be precise, production-minded, and concise. Prefer working code over prose.`;

/**
 * Stream an assistant response as text deltas. Falls back to a realistic
 * demo stream when no ANTHROPIC_API_KEY is configured so the app always runs.
 */
export async function* streamAssistant(
  messages: ChatTurn[]
): AsyncGenerator<string, { tokensIn: number; tokensOut: number }> {
  if (!hasAnthropic()) {
    const demo = demoAnswer(messages[messages.length - 1]?.content || "");
    let out = 0;
    for (const tok of demo) {
      out += 1;
      await new Promise((r) => setTimeout(r, 12));
      yield tok;
    }
    return { tokensIn: 0, tokensOut: out };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let tokensIn = 0;
  let tokensOut = 0;

  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
    if (event.type === "message_start") {
      tokensIn = event.message.usage?.input_tokens ?? 0;
    }
    if (event.type === "message_delta") {
      tokensOut = event.usage?.output_tokens ?? tokensOut;
    }
  }
  return { tokensIn, tokensOut };
}

function demoAnswer(prompt: string): string[] {
  const p = prompt.trim() || "your request";
  const text = `Here's how I'd approach **${p.slice(0, 80)}**.

> Demo mode is active (no \`ANTHROPIC_API_KEY\` set). Add a key in \`.env\` to get real Claude responses — the ad-reward flow below is fully live.

### Plan
1. Parse the requirements and identify the core data flow.
2. Implement a small, testable function.
3. Add error handling and a usage example.

\`\`\`ts
// example.ts
export function solve(input: string): string {
  if (!input) throw new Error("input required");
  return input.trim().toLowerCase();
}

console.log(solve("  AdFunded AI  ")); // "adfunded ai"
\`\`\`

That keeps the implementation isolated and easy to unit test. Want me to extend it with edge cases or wire it into your app?`;
  // tokenize into small chunks for a streaming feel
  return text.match(/\s+|\S+/g) ?? [text];
}
