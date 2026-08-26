<?php

namespace App\Enums;

/**
 * The kinds of node a diagram canvas may contain.
 */
enum DiagramNodeType: string
{
    case Table = 'table';
    case StickyNote = 'stickyNote';

    /**
     * Get every node type as its stored string value.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
