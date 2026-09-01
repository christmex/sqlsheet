import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type { ReactNode } from 'react';

export type ListLayout = 'grid' | 'rows';

type PageToolbar = {
    /** What is being searched for on the page below. */
    search: string;
    setSearch: (search: string) => void;
    layout: ListLayout;
    setLayout: (layout: ListLayout) => void;
    /** Whether the page below actually uses each control. */
    offersSearch: boolean;
    offersLayout: boolean;
    offer: (offered: { search?: boolean; layout?: boolean }) => void;
};

const PageToolbarContext = createContext<PageToolbar | null>(null);

/**
 * The controls that live in the bar above the page.
 *
 * They are drawn by the bar, which belongs to the layout, but they act on the
 * page underneath it — so the two share this rather than the page drawing a bar
 * of its own and the app ending up with two.
 */
export function PageToolbarProvider({ children }: { children: ReactNode }) {
    const [search, setSearch] = useState('');
    const [layout, setLayout] = useState<ListLayout>('grid');
    const [offered, setOffered] = useState({ search: false, layout: false });

    const offer = useCallback(
        (next: { search?: boolean; layout?: boolean }) =>
            setOffered({
                search: next.search ?? false,
                layout: next.layout ?? false,
            }),
        [],
    );

    const value = useMemo(
        () => ({
            search,
            setSearch,
            layout,
            setLayout,
            offersSearch: offered.search,
            offersLayout: offered.layout,
            offer,
        }),
        [layout, offer, offered.layout, offered.search, search],
    );

    return (
        <PageToolbarContext.Provider value={value}>
            {children}
        </PageToolbarContext.Provider>
    );
}

export function usePageToolbar(): PageToolbar {
    const value = useContext(PageToolbarContext);

    if (value === null) {
        throw new Error(
            'usePageToolbar has to be used inside a PageToolbarProvider.',
        );
    }

    return value;
}

/**
 * Say which of the bar's controls this page answers to. Anything not offered
 * is not drawn, so a page without a list never shows a search that does nothing.
 */
export function useOfferedToolbar(offered: {
    search?: boolean;
    layout?: boolean;
}): PageToolbar {
    const toolbar = usePageToolbar();
    const { offer } = toolbar;
    const wantsSearch = offered.search ?? false;
    const wantsLayout = offered.layout ?? false;

    useEffect(() => {
        offer({ search: wantsSearch, layout: wantsLayout });

        return () => offer({});
    }, [offer, wantsLayout, wantsSearch]);

    return toolbar;
}
