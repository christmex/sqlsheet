import { Panel } from '@xyflow/react';
import type { ReactNode } from 'react';

/**
 * What the drawing means.
 *
 * The dashed line is a convention this tool invented, so nothing about it is
 * guessable. It is explained in one place and shown in two — here on the canvas
 * and in the help dialog — so the two can never drift apart.
 */
const legendItems: Array<{ mark: ReactNode; meaning: string }> = [
    {
        mark: (
            <svg width="28" height="8" aria-hidden>
                <line
                    x1="0"
                    y1="4"
                    x2="28"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                />
            </svg>
        ),
        meaning: 'The database enforces this: a real foreign key.',
    },
    {
        mark: (
            <svg width="28" height="8" aria-hidden>
                <line
                    x1="0"
                    y1="4"
                    x2="28"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                />
            </svg>
        ),
        meaning:
            'A reference only. The column points there, nothing checks it.',
    },
    {
        mark: <span className="font-mono text-[10px]">1 · N</span>,
        meaning: 'How many rows take part at each end.',
    },
    {
        mark: (
            <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                PK
            </span>
        ),
        meaning:
            'Primary key. FK is a foreign key, UQ is unique, IX is indexed.',
    },
];

export function LegendRows() {
    return (
        <ul className="space-y-1.5">
            {legendItems.map((item) => (
                <li key={item.meaning} className="flex items-center gap-2.5">
                    <span className="flex w-8 shrink-0 justify-center text-neutral-500 dark:text-neutral-400">
                        {item.mark}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {item.meaning}
                    </span>
                </li>
            ))}
        </ul>
    );
}

export default function DiagramLegend() {
    return (
        <Panel position="bottom-left" className="ml-12!">
            <div
                className="rounded-lg border border-neutral-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90"
                data-test="diagram-legend"
            >
                <LegendRows />
            </div>
        </Panel>
    );
}
