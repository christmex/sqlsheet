import { Panel, useReactFlow } from '@xyflow/react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
    useDiagramSearchActions,
    useDiagramSearchState,
} from '@/hooks/use-diagram-search';
import { textMatchesSearch } from '@/lib/erd';
import { cn } from '@/lib/utils';
import type { DiagramNode } from '@/types';

type SearchBoxProps = {
    nodes: DiagramNode[];
};

const stepButtonStyles =
    'rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800 dark:hover:text-neutral-100';

/**
 * Find a table or a column by name.
 *
 * Matches are marked where they are, rather than listed somewhere else: a
 * diagram is a picture, and the answer to "where is that column" is a place on
 * it. The box only steps the view from one match to the next.
 */
export default function SearchBox({ nodes }: SearchBoxProps) {
    const { term, isOpen } = useDiagramSearchState();
    const { setTerm, close } = useDiagramSearchActions();
    const { setCenter } = useReactFlow();

    /**
     * Which match the view has been taken to, or nothing while the view has not
     * been moved yet. Starting at the first match would claim the diagram is
     * already showing it, and the first Enter would then skip past it.
     */
    const [matchIndexInView, setMatchIndexInView] = useState<number | null>(
        null,
    );
    const inputRef = useRef<HTMLInputElement>(null);

    /**
     * The table each match belongs to, one entry per match — a table whose name
     * and three of whose columns match is found four times, which is what the
     * count says and what stepping walks through.
     */
    const matches = useMemo<string[]>(() => {
        if (term.trim() === '') {
            return [];
        }

        return nodes.flatMap((node) => {
            if (node.type !== 'table') {
                return [];
            }

            const namesInThisTable = [
                node.data.name,
                ...node.data.columns.map((column) => column.name),
            ];

            return namesInThisTable
                .filter((name) => textMatchesSearch(name, term))
                .map(() => node.id);
        });
    }, [nodes, term]);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    /**
     * A diagram edited while the search is open can leave fewer matches than
     * the view was taken to, so where it stands is worked out rather than kept.
     */
    const atMatch =
        matchIndexInView === null || matches.length === 0
            ? null
            : matchIndexInView % matches.length;

    const stepTo = (next: number) => {
        if (matches.length === 0) {
            return;
        }

        const wrapped = (next + matches.length) % matches.length;
        const node = nodes.find(
            (candidate) => candidate.id === matches[wrapped],
        );

        setMatchIndexInView(wrapped);

        if (node !== undefined) {
            setCenter(
                node.position.x + (node.measured?.width ?? 0) / 2,
                node.position.y + (node.measured?.height ?? 0) / 2,
                { duration: 300, zoom: 1 },
            );
        }
    };

    return (
        <Panel position="top-left" className="mt-20!">
            <div
                data-test="search-box"
                className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
            >
                <Search className="ml-1 size-3.5 shrink-0 text-neutral-400" />

                <Input
                    ref={inputRef}
                    aria-label="Search tables and columns"
                    data-test="search-term"
                    placeholder="Find a table or column"
                    className="h-7 w-52 border-0 text-xs shadow-none focus-visible:ring-0"
                    value={term}
                    onChange={(event) => {
                        setTerm(event.target.value);
                        setMatchIndexInView(null);
                    }}
                    onKeyDown={(event) => {
                        event.stopPropagation();

                        if (event.key === 'Enter') {
                            event.preventDefault();

                            if (atMatch === null) {
                                stepTo(event.shiftKey ? matches.length - 1 : 0);
                            } else {
                                stepTo(
                                    event.shiftKey ? atMatch - 1 : atMatch + 1,
                                );
                            }
                        }

                        if (event.key === 'Escape') {
                            close();
                        }
                    }}
                />

                <span
                    data-test="search-count"
                    className="w-16 shrink-0 text-center text-[11px] text-muted-foreground tabular-nums"
                >
                    {term.trim() === ''
                        ? ''
                        : matches.length === 0
                          ? 'nothing'
                          : atMatch === null
                            ? `${matches.length} found`
                            : `${atMatch + 1} of ${matches.length}`}
                </span>

                <button
                    type="button"
                    aria-label="Previous match"
                    className={cn(stepButtonStyles)}
                    disabled={matches.length === 0}
                    onClick={() =>
                        stepTo(
                            atMatch === null ? matches.length - 1 : atMatch - 1,
                        )
                    }
                >
                    <ChevronUp className="size-3.5" />
                </button>

                <button
                    type="button"
                    aria-label="Next match"
                    className={cn(stepButtonStyles)}
                    disabled={matches.length === 0}
                    onClick={() => stepTo(atMatch === null ? 0 : atMatch + 1)}
                >
                    <ChevronDown className="size-3.5" />
                </button>

                <button
                    type="button"
                    aria-label="Close search"
                    data-test="close-search"
                    className={cn(stepButtonStyles)}
                    onClick={close}
                >
                    <X className="size-3.5" />
                </button>
            </div>
        </Panel>
    );
}
