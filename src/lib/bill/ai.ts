import { z } from "zod";

export interface RecognizedLine {
  itemNo: number | null;
  rawText: string;
  quantity: number;
  confidence: number | null;
}

const DEFAULT_BASE_URL = "https://api.minimaxi.com/v1";
const DEFAULT_MODEL = "MiniMax-M3";

const lineSchema = z.object({
  itemNo: z.number().int().nullable().catch(null),
  rawText: z.string(),
  quantity: z.number().int().min(1).catch(1),
  confidence: z.number().nullable().catch(null),
});

const responseSchema = z.array(lineSchema);

const INSTRUCTION = [
  "You are reading a photo of a handwritten or printed restaurant order.",
  "Compare each ordered line against the numbered menu below.",
  "For every ordered line, output an object",
  '{ "itemNo": number|null, "rawText": string, "quantity": number, "confidence": number }.',
  "itemNo is the matching menu number; use null when no menu item matches.",
  "rawText is the text you read for that line. quantity defaults to 1 when unwritten.",
  "confidence is your match certainty from 0 to 1.",
  "Respond with ONLY a JSON array, no extra prose, no markdown.",
  "",
  "Numbered menu:",
].join("\n");

// MiniMax-M3 is a reasoning model: it may prepend a <think>...</think> block
// and/or wrap the answer in ```json fences before the actual JSON array. Strip
// the reasoning + fences, then slice from the first '[' to the last ']' so any
// leftover prose can't break JSON.parse.
function extractJsonArray(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  return t.trim();
}

/**
 * Calls the MiniMax (OpenAI-compatible) vision model to read a handwritten or
 * printed restaurant order against a numbered menu. Returns one line per
 * ordered item. Throws on missing config, HTTP failure, or unparseable output;
 * the caller (recognize route) maps thrown errors to a 500.
 */
export async function recognizeOrder(
  imageDataUrl: string,
  numberedMenu: string,
): Promise<RecognizedLine[]> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("MINIMAX_API_KEY is not set");
  const baseUrl = process.env.MINIMAX_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.BILL_AI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${INSTRUCTION}\n${numberedMenu}` },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`MiniMax request failed: ${res.status} ${detail}`.trim());
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("MiniMax response missing message content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(content));
  } catch {
    throw new Error("MiniMax response was not valid JSON");
  }

  const lines = responseSchema.safeParse(parsed);
  if (!lines.success) {
    throw new Error("MiniMax response did not match the expected shape");
  }
  return lines.data;
}
