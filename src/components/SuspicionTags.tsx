"use client";

import { useTranslation } from "react-i18next";
import type { SuspicionType } from "@/lib/types";
import { SUSPICION_TYPES } from "@/lib/types";

interface SuspicionTagsProps {
  typeBreakdown: Record<SuspicionType, number>;
  onClick?: (type: SuspicionType) => void;
  selected?: SuspicionType[];
  interactive?: boolean;
}

export default function SuspicionTags({
  typeBreakdown,
  onClick,
  selected = [],
  interactive = false,
}: SuspicionTagsProps) {
  const { t } = useTranslation();

  const hasData = Object.values(typeBreakdown).some((v) => v > 0);

  if (!hasData) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {SUSPICION_TYPES.map((st) => {
        const count = typeBreakdown[st.id];
        if (count === 0) return null;

        const isSelected = selected.includes(st.id);
        const baseClasses = "badge cursor-default text-white text-xs";
        const selectedClasses = interactive ? "cursor-pointer ring-2 ring-offset-1 ring-surface-400" : "";

        return (
          <span
            key={st.id}
            className={`${baseClasses} ${selectedClasses}`}
            style={{
              backgroundColor: st.color,
              opacity: isSelected ? 1 : 0.85,
            }}
            onClick={() => interactive && onClick?.(st.id)}
          >
            {st.label} {count}
          </span>
        );
      })}
    </div>
  );
}
