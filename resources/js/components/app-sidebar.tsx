import { Link, usePage } from '@inertiajs/react';
import { Table2 } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { index as diagramsIndex } from '@/routes/diagrams';
import type { NavItem } from '@/types';

export function AppSidebar() {
    const page = usePage();
    const teamSlug = page.props.currentTeam?.slug;
    const homeUrl = teamSlug ? diagramsIndex(teamSlug) : '/';

    const mainNavItems: NavItem[] = teamSlug
        ? [
              {
                  title: 'Diagrams',
                  href: diagramsIndex(teamSlug),
                  icon: Table2,
                  badge: page.props.diagramCount ?? undefined,
              },
          ]
        : [];

    return (
        <Sidebar collapsible="icon" variant="floating">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={homeUrl} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <TeamSwitcher />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
