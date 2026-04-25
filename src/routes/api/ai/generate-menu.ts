import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface GeneratedItem {
  name: string;
  description: string;
  price: number;
  category: string;
}

export const Route = createFileRoute("/api/ai/generate-menu")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // --- AuthN: require a valid Supabase session ---
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          if (!token) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
          const supabaseAnon =
            process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (!supabaseUrl || !supabaseAnon) {
            console.error("generate-menu: Supabase env not configured for auth verification");
            return Response.json({ error: "An unexpected error occurred" }, { status: 500 });
          }
          const sb = createClient(supabaseUrl, supabaseAnon);
          const { data: userData, error: userErr } = await sb.auth.getUser(token);
          if (userErr || !userData?.user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const { prompt } = (await request.json()) as { prompt?: string };
          if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
            return Response.json({ error: "Prompt is required (min 3 chars)" }, { status: 400 });
          }
          if (prompt.length > 2000) {
            return Response.json({ error: "Prompt is too long (max 2000 chars)" }, { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return Response.json(
              { error: "AI is not configured. LOVABLE_API_KEY missing." },
              { status: 500 },
            );
          }

          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "You are an expert restaurant menu writer. Given a description of a restaurant or list of dishes, generate brand new, polished menu items strictly derived from the user's input. Infer cuisine, vibe, and price range from the prompt. Do NOT reuse generic placeholders. Each item must have: name (concise, appetizing), description (1-2 sentences highlighting ingredients), price (USD number with realistic value for the implied tier), category (e.g., Starters, Mains, Desserts, Drinks). Generate 4-8 items.",
                },
                { role: "user", content: prompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "return_menu_items",
                    description: "Return the generated menu items.",
                    parameters: {
                      type: "object",
                      properties: {
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              description: { type: "string" },
                              price: { type: "number" },
                              category: { type: "string" },
                            },
                            required: ["name", "description", "price", "category"],
                            additionalProperties: false,
                          },
                          minItems: 1,
                        },
                      },
                      required: ["items"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "return_menu_items" } },
            }),
          });

          if (res.status === 429) {
            return Response.json(
              { error: "Rate limit exceeded. Please wait a moment and try again." },
              { status: 429 },
            );
          }
          if (res.status === 402) {
            return Response.json(
              { error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." },
              { status: 402 },
            );
          }
          if (!res.ok) {
            const text = await res.text();
            console.error("AI gateway error:", res.status, text);
            return Response.json({ error: "AI service error" }, { status: 500 });
          }

          const data = await res.json();
          const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
          const argsRaw = toolCall?.function?.arguments;
          if (!argsRaw) {
            return Response.json({ error: "AI did not return structured items" }, { status: 500 });
          }
          const parsed = JSON.parse(argsRaw) as { items: GeneratedItem[] };
          return Response.json({ items: parsed.items ?? [] });
        } catch (e) {
          console.error("generate-menu error:", e);
          return Response.json(
            { error: "An unexpected error occurred" },
            { status: 500 },
          );
        }
      },
    },
  },
});