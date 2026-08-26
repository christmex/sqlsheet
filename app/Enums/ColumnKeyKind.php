<?php

namespace App\Enums;

/**
 * The keys a diagram column can take part in.
 */
enum ColumnKeyKind: string
{
    case Primary = 'primary';
    case Foreign = 'foreign';
    case Unique = 'unique';

    /**
     * Get every key kind as its stored string value.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
