"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, X, MessageCircle, Bot } from "lucide-react";
import { Button } from "@aigarth/ui";
import { Input } from "@aigarth/ui";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@aigarth/utils";

const SUGGESTIONS = [
  "How does staking work?",
  "Recommend a plan for my team",
  "Estimate compute for 1M requests/mo",
  "Generate an API key",
];

export function AssistantWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content: "Hi. I'm the Aigarth assistant. Ask me about staking, compute, or building on the network.",
    },
  ]);
  const [input, setInput] = React.useState("");

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      {
        role: "assistant",
        content:
          "Thanks. The dashboard is the right next step. I can walk you through staking or help you generate a key.",
      },
    ]);
    setInput("");
  };

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: "spring" }}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-2xl",
          "bg-foreground text-background transition-transform hover:scale-105",
          open && "scale-90 opacity-0 pointer-events-none"
        )}
        aria-label="Open assistant"
      >
        <Sparkles className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-garden-500 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-garden-500" />
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <LogoMark size={20} />
                </div>
                <div>
                  <div className="text-sm font-medium">Aigarth Assistant</div>
                  <div className="text-xs text-muted-foreground">
                    Powered by Aigarth Inference
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {messages.length === 1 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs text-muted-foreground">Try asking</div>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full rounded-lg border bg-background p-2.5 text-left text-xs hover:border-primary hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  className="flex-1"
                />
                <Button type="submit" size="icon" aria-label="Send">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
