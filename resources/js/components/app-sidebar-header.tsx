import { LayoutGrid, Rows3, Search } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItemType[];
};

const layoutButtonStyles =
    'flex size-8 items-center justify-center rounded-lg transition-colors';

/**
 * The bar over the page.
 *
 * It floats as its own panel rather than running edge to edge, so the warm page
 * shows around it. The search and the layout switch belong to the page beneath
 * it, and appear only when that page hands them over.
 */
export function AppSidebarHeader({ breadcrumbs = [] }: Props) {
    const { search, setSearch, layout, setLayout, offersSearch, offersLayout } =
        usePageToolbar();

    return (
        <header className="mx-3 mt-3 mb-3 flex h-16 shrink-0 items-center gap-3 rounded-2xl bg-card/70 px-4 shadow-sm ring-1 ring-border/60 md:mx-4">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumbs breadcrumbs={breadcrumbs} />

            {offersSearch && (
                <div className="relative ml-2 max-w-md flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search diagrams"
                        data-test="header-search"
                        placeholder="Search diagrams…"
                        className="h-10 rounded-xl border-transparent bg-background pl-9"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
            )}

            {offersLayout && (
                <div className="ml-auto flex items-center gap-1 rounded-xl bg-background p-1 ring-1 ring-border/60">
                    <button
                        type="button"
                        aria-label="Show as cards"
                        aria-pressed={layout === 'grid'}
                        data-test="layout-grid"
                        className={cn(
                            layoutButtonStyles,
                            layout === 'grid'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => setLayout('grid')}
                    >
                        <LayoutGrid className="size-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="Show as rows"
                        aria-pressed={layout === 'rows'}
                        data-test="layout-rows"
                        className={cn(
                            layoutButtonStyles,
                            layout === 'rows'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => setLayout('rows')}
                    >
                        <Rows3 className="size-4" />
                    </button>
                </div>
            )}
        </header>
    );
}
