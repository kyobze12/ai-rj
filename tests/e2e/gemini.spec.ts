import { test, expect } from "@playwright/test";
import { llmScript } from "../../src/lib/script";
import { DEFAULT_PREFS } from "../../src/lib/prefs";

const input = { prefs: DEFAULT_PREFS, index: 1, kind: "full" as const, headlines: [], next: { name: "Song", artists: "Artist" } };
const providerKeys = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "LLM_API_KEY"] as const;

async function withMockedGemini(response: () => Response, run: (requests: Request[]) => Promise<void>) {
  const saved = Object.fromEntries(providerKeys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const requests: Request[] = [];
  for (const key of providerKeys) delete process.env[key];
  process.env.GEMINI_API_KEY = "test-gemini-key";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return response();
  }) as typeof fetch;
  console.warn = () => {};
  try { await run(requests); }
  finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    for (const key of providerKeys) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Gemini writes an RJ line using the server-side configured provider", async () => {
  await withMockedGemini(() => new Response(JSON.stringify({
    candidates: [{ content: { role: "model", parts: [{ text: "[warm] Gemini keeps the night moving." }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8, totalTokenCount: 18 },
  }), { status: 200, headers: { "content-type": "application/json" } }), async (requests) => {
    const text = await llmScript(input);
    expect(text).toBe("[warm] Gemini keeps the night moving.");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain("gemini-2.5-flash-lite:generateContent");
    expect(requests[0].headers.get("x-goog-api-key")).toBe("test-gemini-key");
  });
});

test("Gemini rate limits do not retry and return control to the template fallback", async () => {
  await withMockedGemini(() => new Response(JSON.stringify({ error: { code: 429, message: "quota exceeded", status: "RESOURCE_EXHAUSTED" } }), {
    status: 429, headers: { "content-type": "application/json" },
  }), async (requests) => {
    const text = await llmScript(input);
    expect(text).toBeNull();
    expect(requests).toHaveLength(1);
  });
});
