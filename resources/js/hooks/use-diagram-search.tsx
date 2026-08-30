import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';
import type { ReactNode } from 'react';

type SearchActions = {
    setTerm: (term: string) => void;
    open: () => void;
    close: () => void;
};

type SearchState = {
    /** What is being looked for. Empty while the search is closed. */
    term: string;
    isOpen: boolean;
};

/**
 * The two halves are held apart on purpose.
 *
 * The term changes with every key pressed, and every table on the canvas reads
 * it. Anything sharing that value would be redrawn on every keystroke too — the
 * toolbar only ever needs to open the search, so it reads the half that never
 * changes.
 */
const SearchActionsContext = createContext<SearchActions | null>(null);
const SearchStateContext = createContext<SearchState | null>(null);

export function DiagramSearchProvider({ children }: { children: ReactNode }) {
    const [term, setTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const open = useCallback(() => setIsOpen(true), []);

    /**
     * Closing forgets the term. A diagram left dimmed around a search nobody
     * can see reads as broken rather than filtered.
     */
    const close = useCallback(() => {
        setIsOpen(false);
        setTerm('');
    }, []);

    const actions = useMemo(() => ({ setTerm, open, close }), [close, open]);
    const state = useMemo(() => ({ term, isOpen }), [isOpen, term]);

    return (
        <SearchActionsContext.Provider value={actions}>
            <SearchStateContext.Provider value={state}>
                {children}
            </SearchStateContext.Provider>
        </SearchActionsContext.Provider>
    );
}

/**
 * Ways to drive the search. Reading these never causes a redraw.
 */
export function useDiagramSearchActions(): SearchActions {
    const value = useContext(SearchActionsContext);

    if (value === null) {
        throw new Error(
            'useDiagramSearchActions has to be used inside a DiagramSearchProvider.',
        );
    }

    return value;
}

/**
 * What is being looked for. Reading this redraws on every key pressed.
 */
export function useDiagramSearchState(): SearchState {
    const value = useContext(SearchStateContext);

    if (value === null) {
        throw new Error(
            'useDiagramSearchState has to be used inside a DiagramSearchProvider.',
        );
    }

    return value;
}
