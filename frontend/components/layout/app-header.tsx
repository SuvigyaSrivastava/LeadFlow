import { TrendingUp } from "lucide-react";

export function AppHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <span className="grid size-8 place-items-center rounded-md bg-accent text-white">
          <TrendingUp className="size-4" aria-hidden />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">LeadFlow</span>
        <span className="hidden text-sm text-muted sm:inline">Relationship workspace</span>
      </div>
    </header>
  );
}
