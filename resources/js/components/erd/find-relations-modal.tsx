import { useReactFlow } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    applyRelationToColumns,
    edgeFromSuggestion,
    findSuggestedRelations,
    maximumEdgesPerDiagram,
} from '@/lib/erd';
import type { DiagramNode, RelationEdge } from '@/types';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/**
 * Offer the relations the naming convention implies, and draw the ones agreed to.
 *
 * Nothing is drawn without being ticked: accepting a relation rewrites the foreign
 * key column's type to match what it points at, and deleting the line afterwards
 * does not put the old type back.
 */
export default function FindRelationsModal({ open, onOpenChange }: Props) {
    const { getNodes, getEdges, setNodes, setEdges } = useReactFlow<
        DiagramNode,
        RelationEdge
    >();

    const suggestions = useMemo(
        () => (open ? findSuggestedRelations(getNodes(), getEdges()) : []),
        [getEdges, getNodes, open],
    );

    const [rejectedKeys, setRejectedKeys] = useState<string[]>([]);

    const isAccepted = (key: string, isSelfReference: boolean) =>
        isSelfReference
            ? rejectedKeys.includes(`accept:${key}`)
            : !rejectedKeys.includes(key);

    const toggle = (key: string, isSelfReference: boolean) =>
        setRejectedKeys((current) => {
            const marker = isSelfReference ? `accept:${key}` : key;

            return current.includes(marker)
                ? current.filter((existing) => existing !== marker)
                : [...current, marker];
        });

    const accepted = suggestions.filter((suggestion) =>
        isAccepted(suggestion.key, suggestion.isSelfReference),
    );

    const draw = () => {
        let nodes = getNodes();

        /**
         * The canvas can have moved on since this list was drawn up — a table
         * deleted, an undo pressed. An edge pointing at something that is gone is
         * refused by the server on every later save, and cannot be deleted from
         * the canvas because it has nothing left to render against.
         */
        const stillThere = accepted.filter((suggestion) =>
            [
                {
                    nodeId: suggestion.referencedNodeId,
                    columnId: suggestion.referencedColumnId,
                },
                {
                    nodeId: suggestion.keyNodeId,
                    columnId: suggestion.keyColumnId,
                },
            ].every(({ nodeId, columnId }) => {
                const node = nodes.find((candidate) => candidate.id === nodeId);

                return (
                    node?.type === 'table' &&
                    node.data.columns.some((column) => column.id === columnId)
                );
            }),
        );

        const room = maximumEdgesPerDiagram - getEdges().length;
        const drawable = stillThere.slice(0, Math.max(room, 0));

        drawable.forEach((suggestion) => {
            nodes = applyRelationToColumns(
                nodes,
                {
                    nodeId: suggestion.referencedNodeId,
                    columnId: suggestion.referencedColumnId,
                },
                {
                    nodeId: suggestion.keyNodeId,
                    columnId: suggestion.keyColumnId,
                },
            ).nodes;
        });

        setNodes(nodes);
        setEdges((currentEdges) => [
            ...currentEdges,
            ...drawable.map(edgeFromSuggestion),
        ]);

        if (drawable.length < accepted.length) {
            toast.warning(
                `${accepted.length - drawable.length} could not be drawn: what they point at has changed, or this diagram is full at ${maximumEdgesPerDiagram} relations.`,
            );
        }

        if (drawable.length > 0) {
            toast.success(
                `Drew ${drawable.length} ${drawable.length === 1 ? 'relation' : 'relations'}.`,
            );
        }

        setRejectedKeys([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Relations the names suggest</DialogTitle>
                    <DialogDescription>
                        Accepting one gives the foreign key column the type of
                        the column it points at. Deleting the line later does
                        not put the old type back.
                    </DialogDescription>
                </DialogHeader>

                {suggestions.length === 0 ? (
                    <p
                        className="py-4 text-sm text-muted-foreground"
                        data-test="no-suggestions"
                    >
                        Nothing to suggest. Either every matching column already
                        has a relation, or no column is named after another
                        table&apos;s primary key.
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {suggestions.map((suggestion) => (
                            <li key={suggestion.key}>
                                <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-accent">
                                    <Checkbox
                                        className="mt-0.5"
                                        checked={isAccepted(
                                            suggestion.key,
                                            suggestion.isSelfReference,
                                        )}
                                        onCheckedChange={() =>
                                            toggle(
                                                suggestion.key,
                                                suggestion.isSelfReference,
                                            )
                                        }
                                        data-test={`suggestion-${suggestion.key}`}
                                    />
                                    <span className="min-w-0">
                                        <span className="block font-mono text-xs">
                                            {suggestion.keyTableName}.
                                            {suggestion.keyColumnName} →{' '}
                                            {suggestion.referencedTableName}.
                                            {suggestion.referencedColumnName}
                                        </span>
                                        {suggestion.isSelfReference && (
                                            <span className="block text-xs text-muted-foreground">
                                                Points at its own table, so this
                                                one is left off unless you say
                                                otherwise.
                                            </span>
                                        )}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                <DialogFooter>
                    <Button
                        variant="secondary"
                        type="button"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={accepted.length === 0}
                        onClick={draw}
                        data-test="draw-relations"
                    >
                        Draw {accepted.length}{' '}
                        {accepted.length === 1 ? 'relation' : 'relations'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
