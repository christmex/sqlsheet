import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { columnKindGroups, columnKindSignatures } from '@/lib/erd';
import { cn } from '@/lib/utils';
import type { ColumnKind } from '@/types';

type Props = {
    value: ColumnKind;
    onChange: (kind: ColumnKind) => void;
};

type Row =
    { sort: 'heading'; label: string } | { sort: 'kind'; kind: ColumnKind };

/**
 * Build the list to show, filtered by what has been typed.
 *
 * With nothing typed the groups are kept, because they are how someone browsing
 * finds a type they cannot name. Once filtering starts the headings only get in
 * the way of arrowing down a short list, so they go.
 */
function rowsFor(query: string): Row[] {
    const wanted = query.trim().toLowerCase();

    if (wanted === '') {
        return columnKindGroups.flatMap((group): Row[] => [
            { sort: 'heading', label: group.label },
            ...group.kinds.map((kind): Row => ({ sort: 'kind', kind })),
        ]);
    }

    return columnKindGroups
        .flatMap((group) => group.kinds)
        .filter(
            (kind) =>
                kind.toLowerCase().includes(wanted) ||
                columnKindSignatures[kind].toLowerCase().includes(wanted),
        )
        .map((kind): Row => ({ sort: 'kind', kind }));
}

export default function ColumnKindPicker({ value, onChange }: Props) {
    const [isOpen, setIsOpen] = useState(true);
    const [query, setQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);

    const rows = useMemo(() => rowsFor(query), [query]);
    const kinds = useMemo(
        () => rows.flatMap((row) => (row.sort === 'kind' ? [row.kind] : [])),
        [rows],
    );

    useEffect(() => {
        listRef.current
            ?.querySelector('[data-highlighted="true"]')
            ?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex, rows]);

    const choose = (kind: ColumnKind) => {
        onChange(kind);
        setIsOpen(false);
        setQuery('');
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                aria-label="Column type"
                className="nodrag flex h-6 w-36 items-center justify-between rounded-md border border-neutral-200 px-1.5 font-mono text-[11px] dark:border-neutral-700"
                onClick={() => setIsOpen(true)}
            >
                {value}
                <ChevronDown className="size-3 opacity-50" />
            </button>
        );
    }

    return (
        <div className="relative w-36">
            <Input
                autoFocus
                aria-label="Column type"
                placeholder={value}
                className="nodrag h-6! w-36 px-1.5 font-mono text-[11px]"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightedIndex(0);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();

                        setHighlightedIndex((current) => {
                            const next =
                                current + (event.key === 'ArrowDown' ? 1 : -1);

                            return Math.max(
                                0,
                                Math.min(next, kinds.length - 1),
                            );
                        });
                    }

                    if (event.key === 'Enter' && kinds[highlightedIndex]) {
                        event.preventDefault();
                        choose(kinds[highlightedIndex]);
                    }
                }}
            />

            <ul
                ref={listRef}
                className="absolute top-full left-0 z-20 mt-1 max-h-72 w-80 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                data-test="column-kind-list"
            >
                {kinds.length === 0 && (
                    <li className="px-2 py-3 text-xs text-muted-foreground">
                        No type matches “{query}”.
                    </li>
                )}

                {rows.map((row) =>
                    row.sort === 'heading' ? (
                        <li
                            key={`heading-${row.label}`}
                            className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                        >
                            {row.label}
                        </li>
                    ) : (
                        <li key={row.kind}>
                            <button
                                type="button"
                                data-highlighted={
                                    kinds[highlightedIndex] === row.kind
                                }
                                className={cn(
                                    'flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left',
                                    kinds[highlightedIndex] === row.kind &&
                                        'bg-accent',
                                )}
                                onMouseEnter={() =>
                                    setHighlightedIndex(kinds.indexOf(row.kind))
                                }
                                onClick={() => choose(row.kind)}
                                data-test={`column-kind-${row.kind}`}
                            >
                                <span className="font-mono text-xs">
                                    {row.kind}
                                    {row.kind === value && ' ✓'}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {columnKindSignatures[row.kind]}
                                </span>
                            </button>
                        </li>
                    ),
                )}
            </ul>
        </div>
    );
}
