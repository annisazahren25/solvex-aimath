import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { PlotBlock } from "./plot-block";

const STEP_LABEL = /^\*\*[^*\n]+?\s*\d+\s*:\*\*/;
const ANSWER_LABEL = /^\*\*\s*(Answer|Jawaban|答案|答|Respuesta|Réponse|Antwort|答え|정답|الإجابة)\s*:\*\*/i;
const ANY_LABEL = /^\*\*[^*\n]+?:\*\*/;

type Block = { type: "step" | "answer" | "normal" | "plot"; content: string };

function splitIntoBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let current: Block = { type: "normal", content: "" };
  const push = () => {
    if (current.content.trim().length) blocks.push(current);
  };
  let inPlot = false;
  let plotBuf = "";
  for (const line of lines) {
    if (!inPlot && /^\s*```plot\s*$/.test(line)) {
      push();
      current = { type: "normal", content: "" };
      inPlot = true;
      plotBuf = "";
      continue;
    }
    if (inPlot) {
      if (/^\s*```\s*$/.test(line)) {
        blocks.push({ type: "plot", content: plotBuf });
        inPlot = false;
        current = { type: "normal", content: "" };
        continue;
      }
      plotBuf += (plotBuf ? "\n" : "") + line;
      continue;
    }
    const trimmed = line.trimStart();
    const isStepStart = STEP_LABEL.test(trimmed);
    const isAnswerStart = !isStepStart && ANSWER_LABEL.test(trimmed);
    const isOtherLabel = !isStepStart && !isAnswerStart && ANY_LABEL.test(trimmed);
    const isHeading = /^#{1,6}\s/.test(trimmed);
    if (isStepStart) {
      push();
      current = { type: "step", content: line };
    } else if (isAnswerStart) {
      push();
      current = { type: "answer", content: line };
    } else if (current.type !== "normal" && (isOtherLabel || isHeading)) {
      push();
      current = { type: "normal", content: line };
    } else {
      current.content += (current.content ? "\n" : "") + line;
    }
  }
  if (inPlot && plotBuf.trim().length) {
    blocks.push({ type: "plot", content: plotBuf });
  }
  push();
  return blocks;
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  );
}

export function MessageContent({ children, className }: { children: string; className?: string }) {
  const blocks = splitIntoBlocks(children);
  return (
    <div className={cn("prose prose-slate max-w-none text-foreground prose-p:my-2 prose-li:my-1 prose-headings:font-display prose-headings:tracking-tight prose-pre:rounded-xl prose-pre:bg-muted prose-code:text-primary prose-strong:text-foreground", className)}>
      {blocks.map((block, i) => {
        if (block.type === "plot") return <PlotBlock key={i} source={block.content} />;
        if (block.type === "normal") return <Markdown key={i}>{block.content}</Markdown>;
        const isAnswer = block.type === "answer";
        return (
          <div
            key={i}
            className={cn(
              "not-prose my-3 rounded-2xl border px-4 py-3 shadow-soft",
              isAnswer
                ? "border-primary/40 bg-primary/10"
                : "border-border bg-accent/40",
            )}
          >
            <div
              className={cn(
                "prose prose-slate max-w-none text-foreground prose-p:my-1",
                isAnswer ? "prose-strong:text-primary" : "prose-strong:text-primary",
              )}
            >
              <Markdown>{block.content}</Markdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}
