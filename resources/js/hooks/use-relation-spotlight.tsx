import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { columnIdFromHandleId } from '@/lib/erd';
import type { RelationEdge } from '@/types';

/**
 * The two ends of the relations picked out right now.
 *
 * Null while none is picked, which is what tells every table it has no reason
 * to step back.
 */
export type RelationSpotlight = {
    nodeIds: Set<string>;
    columnIds: Set<string>;
} | null;

const RelationSpotlightContext = createContext<RelationSpotlight>(null);

/**
 * Work out what a picked relation points at.
 *
 * On a large diagram a relation runs off past a dozen other tables, and reading
 * which two it joins means following a line by eye. Picking the line answers it
 * instead: its two tables stay lit and everything else steps back.
 */
export function spotlightFromEdges(edges: RelationEdge[]): RelationSpotlight {
    const picked = edges.filter((edge) => edge.selected);

    if (picked.length === 0) {
        return null;
    }

    return {
        nodeIds: new Set(picked.flatMap((edge) => [edge.source, edge.target])),
        columnIds: new Set(
            picked.flatMap((edge) => [
                columnIdFromHandleId(edge.sourceHandle ?? ''),
                columnIdFromHandleId(edge.targetHandle ?? ''),
            ]),
        ),
    };
}

export function RelationSpotlightProvider({
    spotlight,
    children,
}: {
    spotlight: RelationSpotlight;
    children: ReactNode;
}) {
    return (
        <RelationSpotlightContext.Provider value={spotlight}>
            {children}
        </RelationSpotlightContext.Provider>
    );
}

export function useRelationSpotlight(): RelationSpotlight {
    return useContext(RelationSpotlightContext);
}
