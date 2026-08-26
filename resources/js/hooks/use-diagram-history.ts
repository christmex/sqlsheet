import { useUpdateNodeInternals } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';
import { canonicalDrawingJson, toStoredEdge, toStoredNode } from '@/lib/erd';
import type {
    DiagramNode,
    RelationEdge,
    StoredDiagramNode,
    StoredRelationEdge,
} from '@/types';

const settleDelayInMilliseconds = 400;
const maximumHistoryEntries = 50;

type DiagramSnapshot = {
    nodes: StoredDiagramNode[];
    edges: StoredRelationEdge[];
    /** Serialised once, because comparing two of these is the hot path. */
    canonical: string;
};

type UseDiagramHistoryOptions = {
    nodes: DiagramNode[];
    edges: RelationEdge[];
    setNodes: (nodes: DiagramNode[]) => void;
    setEdges: (edges: RelationEdge[]) => void;
};

function snapshotOf(
    nodes: DiagramNode[],
    edges: RelationEdge[],
): DiagramSnapshot {
    const storedNodes = nodes.map(toStoredNode);
    const storedEdges = edges.map(toStoredEdge);

    return {
        nodes: storedNodes,
        edges: storedEdges,
        canonical: canonicalDrawingJson(storedNodes, storedEdges),
    };
}

/**
 * Step backwards and forwards through the changes made to a diagram.
 *
 * History is kept as stored snapshots rather than as what is on screen, so
 * selecting a table — which changes the canvas but not the diagram — never
 * becomes something to undo.
 *
 * A change is only recorded once it has settled, so dragging a table across the
 * canvas is one step rather than fifty. Undo and redo settle it first: without
 * that, undo pressed straight after an edit would step over the edit that had not
 * been written down yet and throw it away.
 */
export function useDiagramHistory({
    nodes,
    edges,
    setNodes,
    setEdges,
}: UseDiagramHistoryOptions) {
    const updateNodeInternals = useUpdateNodeInternals();

    const pastRef = useRef<DiagramSnapshot[]>([]);
    const futureRef = useRef<DiagramSnapshot[]>([]);
    const recordedRef = useRef<DiagramSnapshot | null>(null);
    const latestRef = useRef<DiagramSnapshot | null>(null);
    const settleTimerRef = useRef<number | null>(null);
    const isRestoringRef = useRef(false);

    const record = useCallback(() => {
        if (settleTimerRef.current !== null) {
            window.clearTimeout(settleTimerRef.current);
            settleTimerRef.current = null;
        }

        const latest = latestRef.current;
        const recorded = recordedRef.current;

        if (!latest || !recorded || latest.canonical === recorded.canonical) {
            return;
        }

        pastRef.current = [
            ...pastRef.current.slice(-(maximumHistoryEntries - 1)),
            recorded,
        ];
        futureRef.current = [];
        recordedRef.current = latest;
    }, []);

    useEffect(() => {
        const snapshot = snapshotOf(nodes, edges);

        latestRef.current = snapshot;

        if (recordedRef.current === null || isRestoringRef.current) {
            isRestoringRef.current = false;
            recordedRef.current = snapshot;

            return;
        }

        if (snapshot.canonical === recordedRef.current.canonical) {
            return;
        }

        if (settleTimerRef.current !== null) {
            window.clearTimeout(settleTimerRef.current);
        }

        settleTimerRef.current = window.setTimeout(
            record,
            settleDelayInMilliseconds,
        );
    }, [edges, nodes, record]);

    useEffect(
        () => () => {
            if (settleTimerRef.current !== null) {
                window.clearTimeout(settleTimerRef.current);
            }
        },
        [],
    );

    const restore = useCallback(
        (snapshot: DiagramSnapshot) => {
            isRestoringRef.current = true;

            // Fresh arrays: restoring the same snapshot twice would otherwise hand
            // React the identical reference, skip the render, and leave the
            // restoring flag raised to swallow the next real edit.
            setNodes([...snapshot.nodes]);
            setEdges([...snapshot.edges]);

            // The restored tables may hold a different set of columns, and every
            // column carries the connection points relations are drawn between.
            snapshot.nodes.forEach((node) => updateNodeInternals(node.id));
        },
        [setEdges, setNodes, updateNodeInternals],
    );

    const undo = useCallback(() => {
        record();

        const previous = pastRef.current.at(-1);
        const recorded = recordedRef.current;

        if (!previous || !recorded) {
            return;
        }

        pastRef.current = pastRef.current.slice(0, -1);
        futureRef.current = [...futureRef.current, recorded];
        recordedRef.current = previous;

        restore(previous);
    }, [record, restore]);

    const redo = useCallback(() => {
        record();

        const undone = futureRef.current.at(-1);
        const recorded = recordedRef.current;

        if (!undone || !recorded) {
            return;
        }

        futureRef.current = futureRef.current.slice(0, -1);
        pastRef.current = [...pastRef.current, recorded];
        recordedRef.current = undone;

        restore(undone);
    }, [record, restore]);

    return { undo, redo };
}
