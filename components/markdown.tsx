"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Loader2, Maximize, Download, X } from "lucide-react";

interface MarkdownProps {
  children: string;
  className?: string;
}

// =============================================================================
// MERMAID
// =============================================================================

function MermaidBlock({ code }: { code: string }) {
  const id = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      import("mermaid").then(({ default: mermaid }) => {
        if (cancelled) return;

        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          suppressErrorRendering: true,
          theme: isDark ? "dark" : "neutral",
          fontFamily: "inherit",
        });

        const safeId = `mermaid-${id.replace(/:/g, "")}`;
        const processed = code.replace(/\\n/g, "<br/>");

        mermaid
          .parse(processed, { suppressErrors: true })
          .then((valid) => {
            if (cancelled || !valid) {
              if (!cancelled) setError(true);
              return;
            }
            return mermaid.render(safeId, processed);
          })
          .then((result) => {
            if (!cancelled && result) {
              setSvg(result.svg);
              setError(false);
            }
          })
          .catch(() => {
            if (!cancelled) setError(true);
          });
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const safeId = `mermaid-${id.replace(/:/g, "")}`;
      document.getElementById(safeId)?.remove();
      document.getElementById(`d${safeId}`)?.remove();
    };
  }, [code, id]);

  if (!svg && !error) {
    return (
      <div className="my-3 flex items-center justify-center gap-2 rounded-lg border bg-muted/30 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Rendering diagram...</span>
      </div>
    );
  }

  if (error && !svg) {
    return (
      <div className="my-3 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 text-center text-sm text-muted-foreground">
        Failed to render diagram
      </div>
    );
  }

  const handleDownloadPng = () => {
    if (!svg) return;
    const container = document.createElement("div");
    container.innerHTML = svg;
    const svgNode = container.querySelector("svg");
    if (!svgNode) return;

    svgNode.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const viewBox = svgNode.getAttribute("viewBox")?.split(" ").map(Number);
    const w = viewBox?.[2] || 800;
    const h = viewBox?.[3] || 600;
    svgNode.setAttribute("width", String(w));
    svgNode.setAttribute("height", String(h));

    const serialized = new XMLSerializer().serializeToString(svgNode);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(pngBlob);
        a.download = "diagram.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = dataUrl;
  };

  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
        onClick={() => setIsFullscreen(false)}
      >
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); handleDownloadPng(); }}
            title="Download as PNG"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setIsFullscreen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div
          className="max-h-[90vh] w-[90vw] overflow-auto rounded-lg bg-background p-6 [&_svg]:mx-auto [&_svg]:w-full [&_svg]:h-auto"
          onClick={(e) => e.stopPropagation()}
          dangerouslySetInnerHTML={{ __html: svg! }}
        />
      </div>
    );
  }

  return (
    <div
      className="group relative my-3 cursor-pointer overflow-x-auto rounded-lg border bg-background p-4 transition-colors hover:border-primary/30 [&_svg]:max-w-full"
      onClick={() => setIsFullscreen(true)}
    >
      <div dangerouslySetInnerHTML={{ __html: svg! }} className="flex justify-center" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 rounded-b-lg bg-muted/80 py-1.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <Maximize className="h-3 w-3" />
        Click to expand
      </div>
    </div>
  );
}

// =============================================================================
// CODE BLOCK
// =============================================================================

function InlineCodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 group rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{language}</span>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={isDark ? oneDark : oneLight}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.75rem" }}
        showLineNumbers={code.split("\n").length > 3}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
  ),
  li: ({ children }) => <li className="ml-2">{children}</li>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>
  ),
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className || "");
    const isCodeBlock = !!match;

    if (isCodeBlock) {
      const language = match[1];
      const code = String(children).replace(/\n$/, "");

      if (language === "mermaid") {
        return <MermaidBlock code={code} />;
      }

      return <InlineCodeBlock code={code} language={language} />;
    }

    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50 border-b border-border">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-muted-foreground">{children}</td>
  ),
};

// =============================================================================
// EXPORT
// =============================================================================

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
