<?php

namespace App\Enums;

/**
 * The keys and indexes a diagram column can take part in.
 *
 * `Index` is a plain index: not a key at all, but it lives in the same slot on a
 * column and is the difference between a query that scans and one that does not.
 */
enum ColumnKeyKind: string
{
    case Primary = 'primary';
    case Foreign = 'foreign';
    case Unique = 'unique';
    case Index = 'index';

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
