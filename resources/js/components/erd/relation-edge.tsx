import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    Position,
    useReactFlow,
    useInternalNode,
} from '@xyflow/react';
import type { EdgeProps, InternalNode } from '@xyflow/react';
import {
    columnHandleId,
    columnIdFromHandleId,
    foreignKeyEndMarker,
} from '@/lib/erd';
import type {
    ColumnHandleSide,
    DiagramNode,
    RelationEdge as RelationEdgeType,
} from '@/types';

const markerOffsetInPixels = 16;

/**
 * Find where a column's connection point sits on the canvas.
 *
 * Falls back to the middle of the table while React Flow has not measured the
 * handles yet, which happens on the very first render of a freshly added table.
 */
function columnHandlePosition(
    node: InternalNode<DiagramNode>,
    columnId: string,
    side: ColumnHandleSide,
) {
    const handle = (node.internals.handleBounds?.source ?? []).find(
        (candidate) => candidate.id === columnHandleId(columnId, side),
    );

    if (!handle) {
        return {
            x:
                node.internals.positionAbsolute.x +
                (node.measured.width ?? 0) / 2,
            y:
                node.internals.positionAbsolute.y +
                (node.measured.height ?? 0) / 2,
        };
    }

    return {
        x: node.internals.positionAbsolute.x + handle.x + handle.width / 2,
        y: node.internals.positionAbsolute.y + handle.y + handle.height / 2,
    };
}

function horizontalCenterOf(node: InternalNode<DiagramNode>): number {
    return node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2;
}

/**
 * A relation that decides which side of each table to leave from as it is drawn,
 * and marks each end with how many rows may take part there.
 *
 * The counts sit at the ends rather than in the middle: a single label in the
 * middle cannot say which table is the one and which is the many, so it reads
 * backwards as soon as the tables are arranged the other way around.
 */
export default function RelationEdge({
    id,
    source,
    target,
    sourceHandleId,
    targetHandleId,
    data,
    markerEnd,
    style,
    selected,
}: EdgeProps<RelationEdgeType>) {
    const { updateEdgeData } = useReactFlow();
    const sourceNode = useInternalNode<DiagramNode>(source);
    const targetNode = useInternalNode<DiagramNode>(target);

    if (!sourceNode || !targetNode) {
        return null;
    }

    const sourceIsLeftOfTarget =
        horizontalCenterOf(sourceNode) <= horizontalCenterOf(targetNode);

    const sourceSide: ColumnHandleSide = sourceIsLeftOfTarget
        ? 'right'
        : 'left';
    const targetSide: ColumnHandleSide = sourceIsLeftOfTarget
        ? 'left'
        : 'right';

    const sourcePoint = columnHandlePosition(
        sourceNode,
        columnIdFromHandleId(sourceHandleId ?? ''),
        sourceSide,
    );
    const targetPoint = columnHandlePosition(
        targetNode,
        columnIdFromHandleId(targetHandleId ?? ''),
        targetSide,
    );

    const [path] = getSmoothStepPath({
        sourceX: sourcePoint.x,
        sourceY: sourcePoint.y,
        sourcePosition: sourceIsLeftOfTarget ? Position.Right : Position.Left,
        targetX: targetPoint.x,
        targetY: targetPoint.y,
        targetPosition: sourceIsLeftOfTarget ? Position.Left : Position.Right,
        borderRadius: 8,
    });

    const cardinality = data?.cardinality ?? 'one-to-many';
    const foreignKeyEnd = data?.foreignKeyEnd ?? 'target';
    const isConstrained = data?.isConstrained ?? true;

    const toggleCardinality = () =>
        updateEdgeData(id, {
            cardinality:
                cardinality === 'one-to-many' ? 'one-to-one' : 'one-to-many',
            foreignKeyEnd,
            isConstrained,
        });

    const toggleConstraint = () =>
        updateEdgeData(id, {
            cardinality,
            foreignKeyEnd,
            isConstrained: !isConstrained,
        });

    const markers = [
        {
            end: 'source' as const,
            point: sourcePoint,
            pullsLeft: !sourceIsLeftOfTarget,
        },
        {
            end: 'target' as const,
            point: targetPoint,
            pullsLeft: sourceIsLeftOfTarget,
        },
    ];

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                markerEnd={markerEnd}
                style={
                    isConstrained ? style : { ...style, strokeDasharray: '6 4' }
                }
            />
            <EdgeLabelRenderer>
                {markers.map((marker) => {
                    const holdsTheKey = marker.end === foreignKeyEnd;
                    const offset = marker.pullsLeft
                        ? -markerOffsetInPixels
                        : markerOffsetInPixels;

                    return (
                        <button
                            key={marker.end}
                            type="button"
                            data-test={`relation-marker-${marker.end}`}
                            title={
                                holdsTheKey
                                    ? 'Click to switch between one-to-many and one-to-one'
                                    : isConstrained
                                      ? 'The database enforces this. Click to make it a reference only.'
                                      : 'A reference only, not enforced by the database. Click to enforce it.'
                            }
                            className="nodrag nopan pointer-events-auto absolute rounded bg-neutral-50 px-1 font-mono text-[10px] text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400"
                            style={{
                                transform: `translate(-50%, -50%) translate(${marker.point.x + offset}px, ${marker.point.y}px)`,
                                outline: selected
                                    ? '1px solid currentColor'
                                    : undefined,
                            }}
                            onClick={
                                holdsTheKey
                                    ? toggleCardinality
                                    : toggleConstraint
                            }
                        >
                            {holdsTheKey
                                ? foreignKeyEndMarker(cardinality)
                                : '1'}
                        </button>
                    );
                })}
            </EdgeLabelRenderer>
        </>
    );
}
