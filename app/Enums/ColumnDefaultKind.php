<?php

namespace App\Enums;

/**
 * The shapes a column default can take.
 *
 * `CurrentTimestamp` is a call rather than a value — Laravel writes it as
 * `useCurrent()`, and the database fills it in row by row — so it cannot be
 * carried as a literal.
 */
enum ColumnDefaultKind: string
{
    /**
     * A literal default that can be written without escaping tricks.
     *
     * The value is written into a migration file as PHP and from there into a
     * CREATE TABLE as a quoted value. Laravel doubles apostrophes there and does
     * nothing else, so a backslash before the closing quote would swallow it and
     * leave the rest of the statement as DDL. The set stops short of both.
     *
     * `D` anchors the end of the subject rather than the end of the last line:
     * without it a trailing newline passes.
     */
    public const string VALUE_PATTERN = '/^[A-Za-z0-9_ .:+\-\[\]{}]{1,64}$/D';

    case None = 'none';

    case Literal = 'literal';

    case CurrentTimestamp = 'currentTimestamp';
}
