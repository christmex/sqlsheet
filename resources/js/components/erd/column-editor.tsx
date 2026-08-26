import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    columnKeyLabels,
    columnKindGroups,
    columnKindSignatures,
    defaultColumnTypeFor,
    formatColumnType,
} from '@/lib/erd';
import { cn } from '@/lib/utils';
import type {
    ColumnKeyKind,
    ColumnKind,
    ColumnType,
    TableColumn,
} from '@/types';

type ColumnEditorProps = {
    column: TableColumn;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onChange: (changes: Partial<TableColumn>) => void;
};

const keyOrder: ColumnKeyKind[] = ['primary', 'foreign', 'unique'];

const parameterInputStyles = 'nodrag h-6 w-16 px-1 text-[11px]';

const toggleStyles =
    'nodrag h-6 rounded border px-1.5 font-mono text-[11px] transition-colors';

const activeToggleStyles =
    'border-neutral-400 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200';

const inactiveToggleStyles =
    'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300';

/**
 * Edit everything about one column: its type, the parameters that type needs,
 * whether it can be null, and which keys it takes part in.
 *
 * The panel floats below the row rather than sitting inside it, so opening it
 * never changes the row's height — which would move every connection point on
 * the table while the user is in the middle of editing.
 */
export default function ColumnEditor({
    column,
    isOpen,
    onOpen,
    onClose,
    onChange,
}: ColumnEditorProps) {
    const { type, isNullable, keys } = column;
    const containerRef = useRef<HTMLDivElement>(null);

    const changeType = (nextType: ColumnType) => onChange({ type: nextType });

    const toggleKey = (key: ColumnKeyKind) =>
        onChange({
            keys: keys.includes(key)
                ? keys.filter((existing) => existing !== key)
                : keyOrder.filter(
                      (candidate) =>
                          candidate === key || keys.includes(candidate),
                  ),
        });

    /**
     * Close when the click lands elsewhere. The dropdown list itself is rendered in
     * a portal outside this element, so clicking an option must not count as
     * clicking away.
     */
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const closeOnOutsideClick = (event: PointerEvent) => {
            const target = event.target as HTMLElement;

            if (
                containerRef.current?.contains(target) ||
                target.closest('[data-radix-popper-content-wrapper]')
            ) {
                return;
            }

            onClose();
        };

        document.addEventListener('pointerdown', closeOnOutsideClick);

        return () =>
            document.removeEventListener('pointerdown', closeOnOutsideClick);
    }, [isOpen, onClose]);

    return (
        <>
            <span
                className="shrink-0 cursor-pointer font-mono text-[11px] text-neutral-400 dark:text-neutral-500"
                title="Column type"
                onClick={onOpen}
            >
                {formatColumnType(type)}
                {isNullable && '?'}
            </span>

            {isOpen && (
                <div
                    ref={containerRef}
                    className="nodrag nopan absolute top-full left-0 z-10 mt-1 flex w-max items-center gap-1 rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                    onKeyDown={(event) => {
                        event.stopPropagation();

                        if (event.key === 'Enter' || event.key === 'Escape') {
                            onClose();
                        }
                    }}
                >
                    <Select
                        defaultOpen
                        value={type.kind}
                        onValueChange={(kind) =>
                            changeType(defaultColumnTypeFor(kind as ColumnKind))
                        }
                    >
                        <SelectTrigger
                            className="h-6! w-36 px-1.5 font-mono text-[11px]"
                            aria-label="Column type"
                        >
                            <SelectValue>{type.kind}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-96 w-80">
                            {columnKindGroups.map((group) => (
                                <SelectGroup key={group.label}>
                                    <SelectLabel className="text-[11px] tracking-wide text-muted-foreground uppercase">
                                        {group.label}
                                    </SelectLabel>
                                    {group.kinds.map((kind) => (
                                        <SelectItem
                                            key={kind}
                                            value={kind}
                                            className="items-start py-1.5"
                                        >
                                            <span className="flex flex-col gap-0.5">
                                                <span className="font-mono text-xs">
                                                    {kind}
                                                </span>
                                                <span className="font-mono text-[10px] text-muted-foreground">
                                                    {columnKindSignatures[kind]}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>

                    {(type.kind === 'char' || type.kind === 'string') && (
                        <Input
                            type="number"
                            aria-label="Length"
                            className={parameterInputStyles}
                            value={type.length}
                            onChange={(event) =>
                                changeType({
                                    ...type,
                                    length: Number(event.target.value) || 1,
                                })
                            }
                        />
                    )}

                    {(type.kind === 'float' ||
                        type.kind === 'double' ||
                        type.kind === 'decimal') && (
                        <>
                            <Input
                                type="number"
                                aria-label="Precision"
                                className={parameterInputStyles}
                                value={type.precision}
                                onChange={(event) =>
                                    changeType({
                                        ...type,
                                        precision:
                                            Number(event.target.value) || 1,
                                    })
                                }
                            />
                            <Input
                                type="number"
                                aria-label="Scale"
                                className={parameterInputStyles}
                                value={type.scale}
                                onChange={(event) =>
                                    changeType({
                                        ...type,
                                        scale: Number(event.target.value) || 0,
                                    })
                                }
                            />
                        </>
                    )}

                    {(type.kind === 'enum' || type.kind === 'set') && (
                        <Input
                            aria-label="Allowed values"
                            className={`${parameterInputStyles} w-32`}
                            value={type.values.join(',')}
                            onChange={(event) =>
                                changeType({
                                    ...type,
                                    values: event.target.value
                                        .split(',')
                                        .map((value) => value.trim())
                                        .filter((value) => value !== ''),
                                })
                            }
                        />
                    )}

                    {type.kind === 'vector' && (
                        <Input
                            type="number"
                            aria-label="Dimensions"
                            className={parameterInputStyles}
                            value={type.dimensions}
                            onChange={(event) =>
                                changeType({
                                    ...type,
                                    dimensions: Number(event.target.value) || 1,
                                })
                            }
                        />
                    )}

                    {type.kind === 'raw' && (
                        <Input
                            aria-label="Raw definition"
                            className={`${parameterInputStyles} w-32`}
                            value={type.definition}
                            onChange={(event) =>
                                changeType({
                                    ...type,
                                    definition: event.target.value,
                                })
                            }
                        />
                    )}

                    <span className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

                    {keyOrder.map((key) => (
                        <button
                            key={key}
                            type="button"
                            aria-label={columnKeyLabels[key]}
                            data-test={`toggle-${key}`}
                            title={`Toggle ${columnKeyLabels[key]}`}
                            className={cn(
                                toggleStyles,
                                keys.includes(key)
                                    ? activeToggleStyles
                                    : inactiveToggleStyles,
                            )}
                            onClick={() => toggleKey(key)}
                        >
                            {columnKeyLabels[key]}
                        </button>
                    ))}

                    <button
                        type="button"
                        aria-label="Nullable"
                        data-test="toggle-nullable"
                        title="Can this column be null?"
                        className={cn(
                            toggleStyles,
                            isNullable
                                ? activeToggleStyles
                                : inactiveToggleStyles,
                        )}
                        onClick={() => onChange({ isNullable: !isNullable })}
                    >
                        null
                    </button>
                </div>
            )}
        </>
    );
}
