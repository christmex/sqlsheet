import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                <AppLogoIcon className="size-5 fill-current text-white dark:text-black" />
            </div>
            <div className="ml-1 grid flex-1 text-left">
                <span className="truncate text-sm leading-tight font-semibold">
                    Sqlsheet
                </span>
                <span className="truncate text-xs leading-tight text-muted-foreground">
                    Database designer
                </span>
            </div>
        </>
    );
}
