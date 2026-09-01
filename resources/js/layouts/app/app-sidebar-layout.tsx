import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { PageToolbarProvider } from '@/hooks/use-page-toolbar';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="sidebar">
            <PageToolbarProvider>
                <AppSidebar />
                <AppContent
                    variant="sidebar"
                    className="min-w-0 overflow-x-clip"
                >
                    <AppSidebarHeader breadcrumbs={breadcrumbs} />

                    {/*
                     * The same side padding the bar above uses, so every page
                     * lines up with it instead of each page remembering to.
                     */}
                    <div className="min-h-0 flex-1 px-3 pb-3 md:px-4 md:pb-4">
                        {children}
                    </div>
                </AppContent>
            </PageToolbarProvider>
        </AppShell>
    );
}
