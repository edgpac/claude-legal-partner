import { cn } from "@/lib/utils";

type Level = "high" | "medium" | "low" | "info";

const styles: Record<Level, string> = {
  high: "bg-risk-high-bg text-risk-high",
  medium: "bg-risk-medium-bg text-risk-medium",
  low: "bg-risk-low-bg text-risk-low",
  info: "bg-risk-info-bg text-risk-info",
};

const labels: Record<Level, string> = {
  high: "High risk",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export function RiskBadge({
  level,
  className,
  short,
}: {
  level: Level;
  className?: string;
  short?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[level],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {short ? level : labels[level]}
    </span>
  );
}

export function riskBorderClass(level: Level) {
  return {
    high: "border-l-risk-high",
    medium: "border-l-risk-medium",
    low: "border-l-risk-low",
    info: "border-l-risk-info",
  }[level];
}
