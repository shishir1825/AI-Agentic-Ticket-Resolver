import { useState, useEffect } from "react";
import {
  Upload,
  Sparkles,
  FileCheck,
  Tags,
  ExternalLink,
  Wrench,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Upload, label: "Upload", color: "from-blue-400 to-blue-600", desc: "GTM uploads CRI document" },
  { icon: Sparkles, label: "AI Extract", color: "from-violet-400 to-violet-600", desc: "Agent-1 parses & extracts fields" },
  { icon: FileCheck, label: "GTM Review", color: "from-amber-400 to-amber-600", desc: "GTM verifies extraction" },
  { icon: Tags, label: "Classify", color: "from-purple-400 to-purple-600", desc: "Agent-2 classifies & prioritizes" },
  { icon: ExternalLink, label: "JIRA", color: "from-orange-400 to-orange-600", desc: "Auto-create JIRA ticket" },
  { icon: Wrench, label: "AutoResolve", color: "from-emerald-400 to-emerald-600", desc: "AI analyzes codebase & generates fix PR" },
  { icon: UserCheck, label: "Eng Review", color: "from-teal-400 to-teal-600", desc: "Engineer reviews the fix" },
  { icon: ShieldCheck, label: "EM Sign-off", color: "from-cyan-400 to-cyan-600", desc: "Manager approves the fix" },
  { icon: CheckCircle2, label: "Done", color: "from-green-400 to-green-600", desc: "Issue resolved end-to-end" },
];

export default function AnimatedWorkflow() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Step circles with connecting lines */}
      <div className="flex items-center justify-between gap-0 overflow-x-auto pb-2">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === activeStep;
          const isDone = i < activeStep;

          return (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-500",
                    isActive && `bg-gradient-to-br ${step.color} shadow-lg scale-110`,
                    isDone && "bg-green-500",
                    !isActive && !isDone && "bg-muted border-2 border-border"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors duration-300",
                      isActive || isDone ? "text-white" : "text-muted-foreground"
                    )}
                  />
                  {isActive && (
                    <span className="absolute inset-0 rounded-full border-2 border-white/30 glow-ring" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium transition-colors duration-300 whitespace-nowrap",
                    isActive ? "text-foreground" : isDone ? "text-green-600" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="mx-1 flex items-center">
                  <div
                    className={cn(
                      "h-0.5 w-4 sm:w-6 lg:w-8 transition-colors duration-500",
                      i < activeStep ? "bg-green-400" : i === activeStep ? "bg-cb-blue" : "bg-border"
                    )}
                  />
                  <ArrowRight
                    className={cn(
                      "h-3 w-3 -ml-1 transition-colors duration-500",
                      i < activeStep ? "text-green-400" : i === activeStep ? "text-cb-blue" : "text-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active step description card */}
      <div className="scale-pop" key={activeStep}>
        <div
          className={cn(
            "flex items-center gap-4 rounded-xl border p-4 transition-all",
            `bg-gradient-to-r ${STEPS[activeStep].color}/5`
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
              STEPS[activeStep].color
            )}
          >
            {(() => {
              const Icon = STEPS[activeStep].icon;
              return <Icon className="h-5 w-5 text-white" />;
            })()}
          </div>
          <div>
            <p className="text-sm font-semibold">
              Step {activeStep + 1}: {STEPS[activeStep].label}
            </p>
            <p className="text-sm text-muted-foreground">
              {STEPS[activeStep].desc}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cb-blue to-cb-success transition-all duration-500 ease-out"
          style={{ width: `${((activeStep + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
