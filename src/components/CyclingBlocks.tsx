type Block = {
  id?: string;
  order: number;
  kind: string;
  duration: number;
  targetPower: string;
  repetitions?: number | null;
  recoveryDuration?: number | null;
  recoveryPower?: string | null;
  notes?: string | null;
};

const KIND_LABEL: Record<string, string> = {
  warmup: "Calentamiento",
  steady: "Sostenido",
  interval: "Intervalo",
  cooldown: "Vuelta a la calma",
};

const KIND_ICON: Record<string, string> = {
  warmup: "▸",
  steady: "▬",
  interval: "⚡",
  cooldown: "▾",
};

function renderBlockLine(b: Block): string {
  if (b.kind === "interval" && b.repetitions && b.recoveryDuration) {
    const recPart = b.recoveryPower ? `${b.recoveryDuration}min ${b.recoveryPower} rec` : `${b.recoveryDuration}min rec`;
    return `${b.repetitions}x (${b.duration}min ${b.targetPower} / ${recPart})`;
  }
  return `${b.duration}min ${b.targetPower}`;
}

/**
 * Total duration in minutes for a block accounting for interval repetitions + recovery.
 */
export function blockTotalMinutes(b: Block): number {
  if (b.kind === "interval" && b.repetitions) {
    return (b.duration + (b.recoveryDuration ?? 0)) * b.repetitions;
  }
  return b.duration;
}

export function CyclingBlocks({
  blocks,
  variant = "detailed",
  fallbackDuration,
  fallbackPower,
}: {
  blocks: Block[] | null | undefined;
  variant?: "detailed" | "compact";
  fallbackDuration?: number | null;
  fallbackPower?: string | null;
}) {
  const hasBlocks = Array.isArray(blocks) && blocks.length > 0;

  if (!hasBlocks) {
    if (fallbackDuration) {
      return (
        <div className="text-sm text-accent-cycling">
          {fallbackDuration} min{fallbackPower ? ` — ${fallbackPower}` : ""}
        </div>
      );
    }
    return null;
  }

  const sorted = [...blocks!].sort((a, b) => a.order - b.order);

  if (variant === "compact") {
    return (
      <ul className="list-none ml-3 text-sm text-text-secondary mt-1 space-y-0.5">
        {sorted.map((b) => (
          <li key={b.id ?? b.order}>
            {KIND_ICON[b.kind] ?? "·"} {renderBlockLine(b)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ol className="mt-2 space-y-1.5 text-sm">
      {sorted.map((b) => (
        <li key={b.id ?? b.order} className="flex items-start gap-2">
          <span className="text-accent-cycling font-mono text-xs shrink-0 mt-0.5">
            {KIND_ICON[b.kind] ?? "·"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-text-primary">
              <span className="font-medium">{KIND_LABEL[b.kind] ?? b.kind}</span>
              <span className="text-text-secondary"> — {renderBlockLine(b)}</span>
            </div>
            {b.notes && (
              <div className="text-xs text-text-secondary italic mt-0.5">{b.notes}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
