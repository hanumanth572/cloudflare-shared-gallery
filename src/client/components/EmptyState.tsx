import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <div className="text-4xl" aria-hidden>
        {icon}
      </div>
      <h2 className="text-lg font-medium text-stone-200">{title}</h2>
      <p className="max-w-xs text-sm text-stone-400">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
