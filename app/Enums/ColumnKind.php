<?php

namespace App\Enums;

/**
 * The canonical data types a diagram column may use.
 *
 * Every case is named after the Laravel `Blueprint` method that creates it, so the
 * migration exporter can map a stored column onto a method call without parsing a
 * hand-written type string. `Raw` is the escape hatch for types this list cannot
 * express and maps onto `$table->rawColumn()`.
 *
 * Multi-column helpers such as `timestamps()`, `softDeletes()` and `morphs()` are
 * deliberately absent: each of those adds several columns at once, so they belong
 * on a "add these columns" shortcut rather than in a single column's type.
 */
enum ColumnKind: string
{
    case TinyInteger = 'tinyInteger';
    case SmallInteger = 'smallInteger';
    case MediumInteger = 'mediumInteger';
    case Integer = 'integer';
    case BigInteger = 'bigInteger';
    case UnsignedTinyInteger = 'unsignedTinyInteger';
    case UnsignedSmallInteger = 'unsignedSmallInteger';
    case UnsignedMediumInteger = 'unsignedMediumInteger';
    case UnsignedInteger = 'unsignedInteger';
    case UnsignedBigInteger = 'unsignedBigInteger';
    case Id = 'id';
    case TinyIncrements = 'tinyIncrements';
    case SmallIncrements = 'smallIncrements';
    case MediumIncrements = 'mediumIncrements';
    case Increments = 'increments';
    case BigIncrements = 'bigIncrements';
    case Float = 'float';
    case Double = 'double';
    case Decimal = 'decimal';
    case Char = 'char';
    case String = 'string';
    case TinyText = 'tinyText';
    case Text = 'text';
    case MediumText = 'mediumText';
    case LongText = 'longText';
    case Boolean = 'boolean';
    case Enum = 'enum';
    case Set = 'set';
    case Json = 'json';
    case Jsonb = 'jsonb';
    case Date = 'date';
    case DateTime = 'dateTime';
    case DateTimeTz = 'dateTimeTz';
    case Time = 'time';
    case TimeTz = 'timeTz';
    case Timestamp = 'timestamp';
    case TimestampTz = 'timestampTz';
    case Year = 'year';
    case Uuid = 'uuid';
    case Ulid = 'ulid';
    case ForeignId = 'foreignId';
    case ForeignUuid = 'foreignUuid';
    case ForeignUlid = 'foreignUlid';
    case IpAddress = 'ipAddress';
    case MacAddress = 'macAddress';
    case Binary = 'binary';
    case Geometry = 'geometry';
    case Geography = 'geography';
    case Vector = 'vector';
    case Tsvector = 'tsvector';
    case Raw = 'raw';

    /**
     * Get every canonical kind as its stored string value.
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
