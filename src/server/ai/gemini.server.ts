/**
 * Server-only Gemini client.
 * Uses Google's official REST API directly, with the user-supplied GEMINI_API_KEY.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.0-flash";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY not configured");
  return k;
}

interface GenPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}
interface GenContent {
  role?: string;
  parts: GenPart[];
}

async function callGemini(
  contents: GenContent[],
  opts: { model?: string; jsonSchema?: object; systemInstruction?: string } = {},
): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;
  const url = `${ENDPOINT}/${model}:generateContent?key=${key()}`;

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      ...(opts.jsonSchema
        ? { responseMimeType: "application/json", responseSchema: opts.jsonSchema }
        : {}),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw Object.assign(new Error("Rate limit exceeded. Please wait and try again."), {
      status: 429,
    });
  }
  if (res.status === 402 || res.status === 403) {
    const t = await res.text();
    throw Object.assign(new Error("Gemini quota or permission error: " + t), {
      status: res.status,
    });
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${t}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini returned empty response");
  return text;
}

/* ----------------------------- Image describe ----------------------------- */

export interface DescribedDish {
  name: string;
  description: string;
  suggested_price: number;
  category_guess: string;
}

async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download image (${res.status})`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  const buf = await res.arrayBuffer();
  const data = Buffer.from(buf).toString("base64");
  return { data, mime };
}

export async function describeImage(imageUrl: string): Promise<DescribedDish> {
  const { data, mime } = await fetchImageAsBase64(imageUrl);
  const text = await callGemini(
    [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mime, data } },
          {
            text:
              "You are a restaurant menu writer. Look at this dish photo and produce: a short appetizing dish name (2–6 words), a 1–2 sentence description naming the most likely ingredients and preparation, a realistic suggested USD price, and a category guess (e.g. Starters, Mains, Desserts, Drinks). Respond as JSON.",
          },
        ],
      },
    ],
    {
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          suggested_price: { type: "number" },
          category_guess: { type: "string" },
        },
        required: ["name", "description", "suggested_price", "category_guess"],
      },
    },
  );
  const parsed = JSON.parse(text) as DescribedDish;
  return {
    name: String(parsed.name).slice(0, 120),
    description: String(parsed.description).slice(0, 600),
    suggested_price: Number(parsed.suggested_price) || 0,
    category_guess: String(parsed.category_guess).slice(0, 60),
  };
}

/* ----------------------------- Translate batch ---------------------------- */

export interface TranslateInputItem {
  id: string;
  name: string;
  description?: string | null;
}
export interface TranslateInputCategory {
  id: string;
  name: string;
}

export interface TranslatedItem {
  id: string;
  name: string;
  description: string;
}
export interface TranslatedCategory {
  id: string;
  name: string;
}

export interface TranslationOutput {
  items: TranslatedItem[];
  categories: TranslatedCategory[];
}

export async function translateBatch(
  locale: string,
  items: TranslateInputItem[],
  categories: TranslateInputCategory[],
): Promise<TranslationOutput> {
  if (items.length === 0 && categories.length === 0) {
    return { items: [], categories: [] };
  }

  const payload = {
    target_locale: locale,
    items: items.map((i) => ({ id: i.id, name: i.name, description: i.description ?? "" })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  };

  const text = await callGemini(
    [
      {
        role: "user",
        parts: [
          {
            text:
              "Translate the following restaurant menu data into the target locale. Keep proper nouns and brand names. Keep descriptions concise and appetizing. Return the translated values keyed by the original ids. Input JSON:\n" +
              JSON.stringify(payload),
          },
        ],
      },
    ],
    {
      jsonSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
              },
              required: ["id", "name", "description"],
            },
          },
          categories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
              },
              required: ["id", "name"],
            },
          },
        },
        required: ["items", "categories"],
      },
    },
  );
  return JSON.parse(text) as TranslationOutput;
}

/* ------------------------------ Daily summary ----------------------------- */

export interface DayStats {
  date: string;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  by_platform: Array<{ platform: string; orders: number; revenue: number }>;
  top_items: Array<{ name: string; qty: number }>;
  sync_errors: number;
}

export async function summarizeDay(stats: DayStats): Promise<string> {
  const text = await callGemini(
    [
      {
        role: "user",
        parts: [
          {
            text:
              "Write a friendly 3–5 sentence daily restaurant performance summary for the owner. Mention total orders, revenue, best-performing platform, and one notable insight or trend. Be concise and specific. Avoid generic filler. Stats JSON:\n" +
              JSON.stringify(stats),
          },
        ],
      },
    ],
  );
  return text.trim();
}