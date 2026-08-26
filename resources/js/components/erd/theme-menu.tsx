import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppearance } from '@/hooks/use-appearance';
import type { Appearance } from '@/hooks/use-appearance';

const choices: Array<{
    value: Appearance;
    label: string;
    icon: typeof Sun;
}> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'Match the system', icon: Monitor },
];

/**
 * Switch the canvas between light and dark without leaving it.
 *
 * The choice is the same one the settings page makes, so it follows the user
 * everywhere rather than only applying here.
 */
export default function ThemeMenu() {
    const { appearance, updateAppearance } = useAppearance();

    const current = choices.find((choice) => choice.value === appearance);
    const CurrentIcon = current?.icon ?? Monitor;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    title={`Theme: ${current?.label ?? 'Match the system'}`}
                    data-test="theme-menu"
                >
                    <CurrentIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {choices.map((choice) => (
                    <DropdownMenuItem
                        key={choice.value}
                        onSelect={() => updateAppearance(choice.value)}
                        data-test={`theme-${choice.value}`}
                    >
                        <choice.icon />
                        {choice.label}
                        {appearance === choice.value && (
                            <span className="ml-auto text-xs text-muted-foreground">
                                ✓
                            </span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
