import { useEffect, useRef } from 'react';
import ColumnKindPicker from '@/components/erd/column-kind-picker';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    columnKeyDescriptions,
    columnKeyLabels,
    defaultColumnTypeFor,
    formatColumnType,
    kindsAcceptingCurrentTimestamp,
    noColumnDefault,
} from '@/lib/erd';
import { cn } from '@/lib/utils';
import type {
    ColumnDefault,
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

const keyOrder: ColumnKeyKind[] = ['primary', 'foreign', 'unique', 'index'];

/**
 * The three shapes a default can take.
 *
 * "Now" is a call rather than a value, which is why it is its own shape instead
 * of a magic string the exporter would have to recognise.
 */
const defaultChoices: Array<{
    kind: ColumnDefault['kind'];
    label: string;
    title: string;
    build: (current: ColumnDefault) => ColumnDefault;
}> = [
    {
        kind: 'none',
        label: '—',
        title: 'No default: a row that says nothing about this column stores nothing here.',
        build: () => noColumnDefault,
    },
    {
        kind: 'literal',
        label: 'value',
        title: 'A fixed value the database writes whenever a row says nothing about this column.',
        build: (current) =>
            current.kind === 'literal'
                ? current
                : { kind: 'literal', value: '' },
    },
    {
        kind: 'currentTimestamp',
        label: 'now',
        title: 'The database fills this in with the moment the row is written.',
        build: () => ({ kind: 'currentTimestamp' }),
    },
];

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
    const { type, isNullable, keys, defaultValue } = column;

    const availableDefaultChoices = defaultChoices.filter(
        (choice) =>
            choice.kind !== 'currentTimestamp' ||
            kindsAcceptingCurrentTimestamp.includes(type.kind),
    );
    const containerRef = useRef<HTMLDivElement>(null);

    const changeType = (nextType: ColumnType) => onChange({ type: nextType });

    /**
     * A new kind arrives with no default. A value written for the old kind would
     * otherwise survive into the migration — a word defaulted onto an integer,
     * or a current-time default on a column that cannot hold one.
     */
    const changeKind = (kind: ColumnKind) =>
        onChange({
            type: defaultColumnTypeFor(kind),
            defaultValue: noColumnDefault,
        });

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
                title="The kind of data this column holds. Click to change it."
                onClick={onOpen}
            >
                {formatColumnType(type)}
                {isNullable && '?'}
            </span>

            {isOpen && (
                <TooltipProvider delayDuration={300}>
                    <div
                        ref={containerRef}
                        className="nodrag nopan absolute top-full left-0 z-10 mt-1 flex w-max items-center gap-1 rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                        onKeyDown={(event) => {
                            event.stopPropagation();

                            if (
                                event.key === 'Enter' ||
                                event.key === 'Escape'
                            ) {
                                onClose();
                            }
                        }}
                    >
                        <ColumnKindPicker
                            value={type.kind}
                            onChange={changeKind}
                        />

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
                                            scale:
                                                Number(event.target.value) || 0,
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
                                        dimensions:
                                            Number(event.target.value) || 1,
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
                            <Tooltip key={key}>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={columnKeyDescriptions[key]}
                                        data-test={`toggle-${key}`}
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
                                </TooltipTrigger>
                                <TooltipContent className="max-w-64">
                                    {columnKeyDescriptions[key]}
                                </TooltipContent>
                            </Tooltip>
                        ))}

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    aria-label="Allow this column to hold nothing"
                                    data-test="toggle-nullable"
                                    className={cn(
                                        toggleStyles,
                                        isNullable
                                            ? activeToggleStyles
                                            : inactiveToggleStyles,
                                    )}
                                    onClick={() =>
                                        onChange({ isNullable: !isNullable })
                                    }
                                >
                                    null
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64">
                                Nullable: rows are allowed to leave this column
                                empty. Without it every row must hold a value.
                            </TooltipContent>
                        </Tooltip>

                        <span className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help text-[11px] text-muted-foreground">
                                    default
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64">
                                What the database writes into this column when a
                                new row says nothing about it.
                            </TooltipContent>
                        </Tooltip>

                        {availableDefaultChoices.map((choice) => (
                            <Tooltip key={choice.kind}>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={choice.title}
                                        data-test={`default-${choice.kind}`}
                                        className={cn(
                                            toggleStyles,
                                            defaultValue.kind === choice.kind
                                                ? activeToggleStyles
                                                : inactiveToggleStyles,
                                        )}
                                        onClick={() =>
                                            onChange({
                                                defaultValue:
                                                    choice.build(defaultValue),
                                            })
                                        }
                                    >
                                        {choice.label}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-64">
                                    {choice.title}
                                </TooltipContent>
                            </Tooltip>
                        ))}

                        {defaultValue.kind === 'literal' && (
                            <Input
                                aria-label="Default value"
                                className={`${parameterInputStyles} w-28`}
                                value={defaultValue.value}
                                onChange={(event) =>
                                    onChange({
                                        defaultValue: {
                                            kind: 'literal',
                                            value: event.target.value,
                                        },
                                    })
                                }
                            />
                        )}
                    </div>
                </TooltipProvider>
            )}
        </>
    );
}
