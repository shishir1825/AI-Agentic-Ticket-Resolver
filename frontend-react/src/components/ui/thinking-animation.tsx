import { Brain } from "lucide-react";

interface ThinkingAnimationProps {
  label?: string;
  sublabel?: string;
}

export default function ThinkingAnimation({
  label = "AI is thinking",
  sublabel = "Analyzing codebase and generating fix...",
}: ThinkingAnimationProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="brain-pulse">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cb-blue to-cb-blue/70">
          <Brain className="h-8 w-8 text-white" />
        </div>
      </div>
      <div className="text-center">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="flex gap-1">
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-cb-blue" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-cb-blue" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-cb-blue" />
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
        <div className="progress-glow h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cb-blue/60 via-cb-blue to-cb-blue/60" style={{ animation: "shimmer 1.5s ease-in-out infinite" }} />
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
