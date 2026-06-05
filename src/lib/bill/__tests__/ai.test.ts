import { recognizeOrder } from "../ai";

const IMAGE = "data:image/jpeg;base64,QUJD";
const MENU = "1. 宫保鸡丁 / Kung Pao Chicken $12.00";

function mockModelResponse(content: string): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  }) as unknown as typeof fetch;
}

describe("recognizeOrder", () => {
  beforeEach(() => {
    process.env.MINIMAX_API_KEY = "sk-test";
    delete process.env.MINIMAX_BASE_URL;
    delete process.env.BILL_AI_MODEL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws when the API key is missing", async () => {
    delete process.env.MINIMAX_API_KEY;
    await expect(recognizeOrder(IMAGE, MENU)).rejects.toThrow(/MINIMAX_API_KEY/);
  });

  it("parses a plain JSON array", async () => {
    mockModelResponse(
      JSON.stringify([
        { itemNo: 1, rawText: "宫保鸡丁 x2", quantity: 2, confidence: 0.9 },
      ]),
    );
    const lines = await recognizeOrder(IMAGE, MENU);
    expect(lines).toEqual([
      { itemNo: 1, rawText: "宫保鸡丁 x2", quantity: 2, confidence: 0.9 },
    ]);
  });

  it("strips a ```json fenced block before parsing", async () => {
    mockModelResponse(
      '```json\n[{"itemNo":1,"rawText":"鸡","quantity":1,"confidence":null}]\n```',
    );
    const lines = await recognizeOrder(IMAGE, MENU);
    expect(lines).toEqual([
      { itemNo: 1, rawText: "鸡", quantity: 1, confidence: null },
    ]);
  });

  it("strips a <think> reasoning block (MiniMax-M3 emits one) before parsing", async () => {
    // Real MiniMax-M3 shape observed in a live smoke test: a <think>...</think>
    // block precedes the JSON array.
    mockModelResponse(
      '<think>\nThe order shows two of item 1, so I return one line.\n</think>\n[{"itemNo":1,"rawText":"宫保鸡丁 x2","quantity":2,"confidence":0.8}]',
    );
    const lines = await recognizeOrder(IMAGE, MENU);
    expect(lines).toEqual([
      { itemNo: 1, rawText: "宫保鸡丁 x2", quantity: 2, confidence: 0.8 },
    ]);
  });

  it("handles a <think> block followed by a fenced array", async () => {
    mockModelResponse(
      '<think>reasoning with a stray ] bracket</think>\n```json\n[{"itemNo":null,"rawText":"x","quantity":1,"confidence":null}]\n```',
    );
    const lines = await recognizeOrder(IMAGE, MENU);
    expect(lines[0].itemNo).toBeNull();
  });

  it("keeps itemNo null when the model finds no match", async () => {
    mockModelResponse(
      JSON.stringify([
        { itemNo: null, rawText: "??? something", quantity: 1, confidence: 0.2 },
      ]),
    );
    const lines = await recognizeOrder(IMAGE, MENU);
    expect(lines[0].itemNo).toBeNull();
  });

  it("defaults quantity to 1 and confidence to null when omitted", async () => {
    mockModelResponse(JSON.stringify([{ itemNo: 1, rawText: "鸡" }]));
    const lines = await recognizeOrder(IMAGE, MENU);
    expect(lines[0].quantity).toBe(1);
    expect(lines[0].confidence).toBeNull();
  });

  it("sends a text block and an image_url block to the OpenAI-compatible endpoint", async () => {
    mockModelResponse("[]");
    await recognizeOrder(IMAGE, MENU);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.minimaxi.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const sent = JSON.parse(init.body);
    expect(sent.temperature).toBe(0);
    expect(sent.model).toBe("MiniMax-M3");
    const content = sent.messages[0].content;
    expect(content[0]).toMatchObject({ type: "text" });
    expect(content[0].text).toContain(MENU);
    expect(content[1]).toEqual({
      type: "image_url",
      image_url: { url: IMAGE },
    });
  });

  it("honors MINIMAX_BASE_URL and BILL_AI_MODEL overrides", async () => {
    process.env.MINIMAX_BASE_URL = "https://example.test/v1";
    process.env.BILL_AI_MODEL = "Custom-Model";
    mockModelResponse("[]");
    await recognizeOrder(IMAGE, MENU);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect(JSON.parse(init.body).model).toBe("Custom-Model");
  });

  it("throws on a non-OK HTTP status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    }) as unknown as typeof fetch;
    await expect(recognizeOrder(IMAGE, MENU)).rejects.toThrow(/500/);
  });

  it("throws when the model returns non-JSON content", async () => {
    mockModelResponse("sorry, I cannot read this");
    await expect(recognizeOrder(IMAGE, MENU)).rejects.toThrow(/JSON/);
  });
});
