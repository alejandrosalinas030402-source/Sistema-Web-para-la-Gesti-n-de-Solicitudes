// src/components/ui/Stepper.tsx

import { Check } from "lucide-react";

interface Step {
  label: string;
}

interface Props {
  steps:       Step[];
  currentStep: number; // 1-indexed
}

export function Stepper({ steps, currentStep }: Props) {
  return (
    <div className="flex items-center overflow-x-auto py-2">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isDone   = stepNum < currentStep;

        return (
          <div key={index} className="flex items-center flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 shrink-0 transition-colors
                ${isActive ? "bg-primary text-primary-foreground border-primary" : ""}
                ${isDone   ? "bg-state-success-bg text-state-success-fg border-state-success-fg" : ""}
                ${!isActive && !isDone ? "bg-card text-muted-foreground border-border" : ""}
              `}>
                {isDone ? <Check className="w-3.5 h-3.5" /> : stepNum}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${
                isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
              }`}>
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div className={`h-px w-8 mx-3 shrink-0 ${
                isDone ? "bg-state-success-fg" : "bg-border"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}