<?php

namespace App\Enums;

/**
 * How many rows on each side of a relation may take part in it.
 *
 * Many-to-many is absent on purpose: no migration can create one. It is a pivot
 * table with one of these pointing at it from each side.
 */
enum RelationCardinality: string
{
    case OneToOne = 'one-to-one';
    case OneToMany = 'one-to-many';

    /**
     * Get every cardinality as its stored string value.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
