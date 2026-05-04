import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_STEPS, STEP_TO_INDEX } from "@/lib/constants";

interface StepIndicatorProps {
  currentStep: string;
  status: string;
}

export default function StepIndicator({ currentStep, status }: StepIndicatorProps) {
  const activeIndex = STEP_TO_INDEX[currentStep] ?? 0;
  const failed = status === "failed";

  return (
    <div className="w-full rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-y-2 gap-x-0">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = i < activeIndex || (i === activeIndex && status === "done");
          const active = i === activeIndex && !done;
          const isFailed = active && failed;

          return (
            <div key={step.key} className="flex items-center">
              {i > 0 && (
                <div
                  className={cn(
                    "h-0.5 w-3 sm:w-5",
                    done ? "bg-cb-success" : isFailed ? "bg-cb-danger" : "bg-border"
                  )}
                />
              )}
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full px-1.5 py-0.5 sm:px-2 sm:py-1 transition-colors",
                  active && !isFailed && "bg-cb-blue/10",
                  isFailed && "bg-cb-danger/10",
                  done && "bg-cb-success/5"
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-semibold transition-colors shrink-0",
                    done && "bg-cb-success text-white",
                    active && !isFailed && "bg-cb-blue text-white animate-pulse",
                    isFailed && "bg-cb-danger text-white",
                    !done && !active && "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] sm:text-[11px] font-medium whitespace-nowrap",
                    done && "text-cb-success",
                    active && !isFailed && "text-cb-blue font-semibold",
                    isFailed && "text-cb-danger",
                    !done && !active && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
