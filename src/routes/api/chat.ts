import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const SYSTEM_PROMPT = `You are SolveX, a friendly AI math tutor. You ALWAYS solve problems as a clean, numbered step-by-step breakdown — never as a long paragraph or wall of text.

LANGUAGE MATCHING (CRITICAL):
- ALWAYS reply in the SAME language the user wrote their latest message in.
  - User writes in Indonesian → reply fully in Indonesian (gunakan "Soal", "Langkah", "Jawaban", dst).
  - User writes in English → reply fully in English ("Problem", "Step", "Answer", etc.).
  - User writes in Chinese (中文) → reply fully in Chinese (使用「题目」「步骤」「答案」等).
  - Same rule for any other language (Spanish, Arabic, Japanese, Korean, French, etc.) — mirror the user's language.
- If the message is only an image with no text, infer the language from the text inside the image. If still unknown, default to Indonesian.
- Translate the section headers and labels in the OUTPUT FORMAT below into the user's language (e.g. "Problem" → "Soal" / "题目", "Step" → "Langkah" / "步骤", "Answer" → "Jawaban" / "答案"). Keep all math in LaTeX unchanged.

MULTIPLE QUESTIONS:
- A single user message may contain MORE THAN ONE question. They can come from:
  - Multiple uploaded images (each image may contain one or several problems).
  - A single image containing multiple problems (e.g. numbered 1, 2, 3...).
  - An essay-style text with several questions separated by line breaks, numbering (1., 2., a), b)...), bullets, or "Soal 1 / Soal 2", "Question 1 / Question 2", etc.
- You MUST detect ALL questions and answer EVERY single one — never skip, merge, or summarize them together.
- For each question, render a section header like:
  
  ## Soal 1
  
  then the full numbered step-by-step solution for that question using the OUTPUT FORMAT below. Continue with "## Soal 2", "## Soal 3", etc., in the order they appear.
- If there is only one question, skip the "## Soal N" header and just use the OUTPUT FORMAT directly.
- Separate each question's solution with a blank line so they render as distinct blocks.

OUTPUT FORMAT for EACH question (strict, follow exactly):

**Problem:** <one short line restating the problem, with the equation in LaTeX>

**Step 1:** <one-sentence description of this single operation>
$$<the math for this step>$$

**Step 2:** <next single operation>
$$<the math>$$

... (continue with as many numbered steps as needed, ONE operation per step)

**Answer:** $$\\boxed{<final result>}$$

RULES:
- ALWAYS use LaTeX: $...$ for inline, $$...$$ for display math.
- Each step does exactly ONE thing (e.g. "subtract 3 from both sides", "factor the left side", "apply the quadratic formula"). If a step needs more than one sentence to describe, split it into multiple steps.
- NEVER write paragraphs of prose between steps. Max one short sentence per step.
- Always leave a blank line between steps so they render as separate blocks.
- For images, use "**Problem (from image):**" and the extracted equation in LaTeX. If an image contains multiple problems, list them as "## Soal 1", "## Soal 2", ... and solve each one.
- If the input is not a math question, answer briefly and invite the user to ask a math question.

GRAPHING (x-y plane):
- When the problem involves plotting, sketching, or visualizing a function on the x-y plane (e.g. "sketch the graph", "gambar grafik", linear/quadratic/cubic/exponential/trig graphs, finding intersections of two curves, analyzing roots/intercepts/vertex), include ONE fenced code block with language "plot" right BEFORE the **Answer** block:

  \`\`\`plot
  x: -6..6
  y = x^2 - 4
  y = 2*x + 1
  \`\`\`

- Format rules for the plot block:
  - First line (optional): \`x: <min>..<max>\` defining the x-range. Default is -10..10.
  - Each following line is one function, written as \`y = <expression>\`.
  - Use standard math syntax: \`x^2\`, \`2*x\` (or \`2x\`), \`sin(x)\`, \`cos(x)\`, \`tan(x)\`, \`sqrt(x)\`, \`log(x)\` (base 10), \`ln(x)\`, \`exp(x)\`, \`abs(x)\`, constants \`pi\` and \`e\`.
  - Optional annotated points: \`point: (x, y) "label"\` — use this to highlight special coordinates such as intersections, vertex, maxima/minima, or any coordinate the user is asked to find. Example: \`point: (3, 0) "(3, 0)"\`.
  - Choose the x-range so all important features (roots, vertex, intersections, y-intercept) are clearly visible — typically include a couple of units of padding on each side.
  - DO NOT use LaTeX inside the plot block — plain math syntax only.
  - Include the plot block ONLY when the problem is actually about graphs / plotting / visualizing functions. Do NOT add it for pure algebra/arithmetic/word problems with no graphing aspect.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claimsData.claims.sub as string;

        const body = (await request.json()) as { messages: UIMessage[]; threadId: string; mode?: string };
        const { messages, threadId } = body;
        const mode = (body.mode ?? "simple") as
          | "simple" | "detailed" | "teacher" | "fast" | "exam";
        if (!threadId || !Array.isArray(messages)) {
          return new Response("Bad request", { status: 400 });
        }

        // Verify thread ownership
        const { data: thread, error: tErr } = await supabase
          .from("threads")
          .select("id, title, message_count, is_locked_pending_ad")
          .eq("id", threadId)
          .maybeSingle();
        if (tErr || !thread) {
          return new Response("Thread not found", { status: 404 });
        }

        const { data: isProRow } = await supabase.rpc("has_pro", { _uid: userId });
        const isPro = !!isProRow;
        // Daily message gating happens on the client (blur + ad).
        // The server only marks the assistant message as locked when
        // the free user has already exceeded the daily free cap.
        let lockAssistant = !isPro && !!thread.is_locked_pending_ad;
        if (!isPro && !lockAssistant) {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("role", "user")
            .gte("created_at", start.toISOString());
          // count is taken BEFORE inserting the current user message below,
          // so >= FREE_MSG_LIMIT means this incoming question is over the cap.
          if ((count ?? 0) >= 15) lockAssistant = true;
        }

        // Persist the latest user message
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          await supabase.from("messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: lastUser.parts as unknown as object,
          });

          // Auto-title from first user message
          if (thread.title === "New chat") {
            const firstText =
              lastUser.parts.find((p) => p.type === "text")?.text ?? "New chat";
            const title = firstText.slice(0, 60);
            await supabase.from("threads").update({ title }).eq("id", threadId);
          }
          await supabase
            .from("threads")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", threadId);
        }

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) {
          return new Response("AI gateway not configured", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-2.5-flash");

        const PRO_MODES = new Set(["detailed", "teacher", "exam"]);
        const effectiveMode = !isPro && PRO_MODES.has(mode) ? "simple" : mode;
        const MODE_INSTRUCTIONS: Record<string, string> = {
          simple:
            "EXPLANATION MODE: SIMPLE. Keep explanations very short and beginner friendly. Use minimal steps (aim for 2–4), one short sentence per step, no extra theory. Go straight to the point.",
          fast:
            "EXPLANATION MODE: FAST ANSWER. Prioritize the final answer. Show it first using a brief **Answer:** line, then provide at most 1–2 ultra-compact steps for justification. Keep the whole response tight and minimal.",
          detailed:
            "EXPLANATION MODE: DETAILED. Provide a thorough step-by-step breakdown. Explain every calculation, name and briefly justify each formula or property used, and include intermediate algebraic manipulations. Be educational and complete.",
          teacher:
            "EXPLANATION MODE: TEACHER. Speak like a friendly, patient math teacher guiding a student. Use warm, encouraging language. For each step, briefly explain WHY we do it and WHY the chosen formula or property applies, not just what to compute. Introduce concepts naturally (e.g. \"First, let's identify what we know...\", \"Now we substitute the values into the formula because...\"). Keep the strict numbered step format, but allow one short teaching sentence per step.",
          exam:
            "EXPLANATION MODE: EXAM SHORTCUT. Focus on the fastest path to the answer for a test setting. Prefer shortcuts, tricks, mental-math techniques, and well-known exam patterns (e.g. Vieta's formulas, special triangles, symmetry, elimination). Mention the trick name when relevant. Keep steps minimal and efficient.",
        };
        const modeSystem = `${SYSTEM_PROMPT}\n\n${MODE_INSTRUCTIONS[effectiveMode] ?? MODE_INSTRUCTIONS.simple}`;

        const result = streamText({
          model,
          system: modeSystem,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onError: (error) => {
            console.error("[/api/chat] stream error:", error);
            if (error == null) return "Unknown error";
            if (typeof error === "string") return error;
            if (error instanceof Error) return error.message;
            try {
              return JSON.stringify(error);
            } catch {
              return "Stream error";
            }
          },
          onFinish: async ({ responseMessage }) => {
            await supabase.from("messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              parts: responseMessage.parts as unknown as object,
              is_locked: lockAssistant,
            });
            await supabase.rpc("bump_questions_solved", { _uid: userId });
          },
        });
      },
    },
  },
});
