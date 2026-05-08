/**
 * Server-only Lovable AI Gateway client.
 * Uses LOVABLE_API_KEY (auto-provisioned by Lovable Cloud).
 */

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

interface ToolDef {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: object;
  };
}

function key(): string {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw Object.assign(new Error("AI is not configured."), { status: 500 });
  return k;
}

async function callGateway(opts: {
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  toolName?: string;
}): Promise<any> {
  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: opts.messages,
  };
  if (opts.tools && opts.toolName) {
    body.tools = opts.tools;
    body.tool_choice = { type: "function", function: { name: opts.toolName } };
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw Object.assign(
      new Error("Rate limit exceeded. Please wait a moment and try again."),
      { status: 429 },
    );
  }
  if (res.status === 402) {
    throw Object.assign(
      new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage."),
      { status: 402 },
    );
  }
  if (!res.ok) {
    const text = await res.text();
    console.error("AI gateway error:", res.status, text);
    throw Object.assign(new Error("AI service error"), { status: 500 });
  }
  return res.json();
}

function extractToolArgs<T>(data: any): T {
  const argsRaw = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsRaw) throw Object.assign(new Error("AI did not return structured output"), { status: 500 });
  return JSON.parse(argsRaw) as T;
}

/* ----------------------------- Describe image ----------------------------- */

export interface DescribedDish {
  name: string;
  description: string;
  suggested_price: number;
  category_guess: string;
}

export async function describeImageFromUrl(imageUrl: string): Promise<DescribedDish> {
  const data = await callGateway({
    messages: [
      {
        role: "system",
        content:
          "You are a restaurant menu writer. Look at the dish photo and produce a short appetizing dish name (2-6 words), a 1-2 sentence description naming likely ingredients and preparation, a realistic suggested USD price, and a category guess (Starters, Mains, Desserts, Drinks, etc.). Always call the provided tool.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this dish for a menu." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_dish",
          description: "Return the described dish.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              suggested_price: { type: "number" },
              category_guess: { type: "string" },
            },
            required: ["name", "description", "suggested_price", "category_guess"],
            additionalProperties: false,
          },
        },
      },
    ],
    toolName: "return_dish",
  });

  const parsed = extractToolArgs<DescribedDish>(data);
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
export interface TranslationOutput {
  items: Array<{ id: string; name: string; description: string }>;
  categories: Array<{ id: string; name: string }>;
}

export async function translateMenuBatch(
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

  const data = await callGateway({
    messages: [
      {
        role: "system",
        content:
          "You translate restaurant menu data. Keep proper nouns and brand names. Keep descriptions concise and appetizing. Return translated values keyed by the original ids. Always call the provided tool.",
      },
      {
        role: "user",
        content:
          "Translate every item and category to the target locale. Input JSON:\n" +
          JSON.stringify(payload),
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_translations",
          description: "Return translated items and categories.",
          parameters: {
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
                  additionalProperties: false,
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
                  additionalProperties: false,
                },
              },
            },
            required: ["items", "categories"],
            additionalProperties: false,
          },
        },
      },
    ],
    toolName: "return_translations",
  });

  return extractToolArgs<TranslationOutput>(data);
}