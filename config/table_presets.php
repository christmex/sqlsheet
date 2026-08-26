<?php

use App\Enums\ColumnKeyKind;
use App\Enums\ColumnKind;

/**
 * Ready-made sets of tables a project usually starts with.
 *
 * Every definition here was read from this application's own skeleton migrations
 * rather than recalled, because a preset that is subtly wrong is worse than no
 * preset: it looks right. `tests/Feature/Diagrams/LaravelPresetTest.php` compares
 * the two column by column so they cannot drift apart quietly.
 */
$column = function (
    string $name,
    ColumnKind $kind,
    array $typeParameters = [],
    array $keys = [],
    bool $isNullable = false,
): array {
    return [
        'name' => $name,
        'type' => ['kind' => $kind->value] + $typeParameters,
        'isNullable' => $isNullable,
        'keys' => array_map(fn (ColumnKeyKind $key) => $key->value, $keys),
        'defaultValue' => null,
    ];
};

return [
    [
        'key' => 'laravel-13',
        'name' => 'Laravel 13',
        'description' => 'The eight tables a new Laravel 13 project already has.',
        'caveat' => 'Three things a diagram cannot draw yet are left out: indexes, including the one spanning three columns on failed_jobs; the timestamps pair is written out as two columns; and the current-time default on failed_at is not carried over.',
        /**
         * Laravel's own migrations declare no foreign key constraints at all —
         * `sessions.user_id` is a `foreignId` column with an index and nothing
         * more. The relation is drawn so the diagram reads, and marked as a
         * reference so the exported migration stays what Laravel actually writes.
         */
        'relations' => [
            [
                'from' => ['table' => 'sessions', 'column' => 'user_id'],
                'to' => ['table' => 'users', 'column' => 'id'],
                'isConstrained' => false,
            ],
        ],
        'tables' => [
            [
                'name' => 'users',
                'columns' => [
                    $column('id', ColumnKind::Id, keys: [ColumnKeyKind::Primary]),
                    $column('name', ColumnKind::String, ['length' => 255]),
                    $column('email', ColumnKind::String, ['length' => 255], keys: [ColumnKeyKind::Unique]),
                    $column('email_verified_at', ColumnKind::Timestamp, isNullable: true),
                    $column('password', ColumnKind::String, ['length' => 255]),
                    $column('remember_token', ColumnKind::String, ['length' => 100], isNullable: true),
                    $column('created_at', ColumnKind::Timestamp, isNullable: true),
                    $column('updated_at', ColumnKind::Timestamp, isNullable: true),
                ],
            ],
            [
                'name' => 'sessions',
                'columns' => [
                    $column('id', ColumnKind::String, ['length' => 255], keys: [ColumnKeyKind::Primary]),
                    $column('user_id', ColumnKind::ForeignId, isNullable: true),
                    $column('ip_address', ColumnKind::String, ['length' => 45], isNullable: true),
                    $column('user_agent', ColumnKind::Text, isNullable: true),
                    $column('payload', ColumnKind::LongText),
                    $column('last_activity', ColumnKind::Integer),
                ],
            ],
            [
                'name' => 'password_reset_tokens',
                'columns' => [
                    $column('email', ColumnKind::String, ['length' => 255], keys: [ColumnKeyKind::Primary]),
                    $column('token', ColumnKind::String, ['length' => 255]),
                    $column('created_at', ColumnKind::Timestamp, isNullable: true),
                ],
            ],
            [
                'name' => 'cache',
                'columns' => [
                    $column('key', ColumnKind::String, ['length' => 255], keys: [ColumnKeyKind::Primary]),
                    $column('value', ColumnKind::MediumText),
                    $column('expiration', ColumnKind::BigInteger),
                ],
            ],
            [
                'name' => 'cache_locks',
                'columns' => [
                    $column('key', ColumnKind::String, ['length' => 255], keys: [ColumnKeyKind::Primary]),
                    $column('owner', ColumnKind::String, ['length' => 255]),
                    $column('expiration', ColumnKind::BigInteger),
                ],
            ],
            [
                'name' => 'jobs',
                'columns' => [
                    $column('id', ColumnKind::Id, keys: [ColumnKeyKind::Primary]),
                    $column('queue', ColumnKind::String, ['length' => 255]),
                    $column('payload', ColumnKind::LongText),
                    $column('attempts', ColumnKind::UnsignedSmallInteger),
                    $column('reserved_at', ColumnKind::UnsignedInteger, isNullable: true),
                    $column('available_at', ColumnKind::UnsignedInteger),
                    $column('created_at', ColumnKind::UnsignedInteger),
                ],
            ],
            [
                'name' => 'job_batches',
                'columns' => [
                    $column('id', ColumnKind::String, ['length' => 255], keys: [ColumnKeyKind::Primary]),
                    $column('name', ColumnKind::String, ['length' => 255]),
                    $column('total_jobs', ColumnKind::Integer),
                    $column('pending_jobs', ColumnKind::Integer),
                    $column('failed_jobs', ColumnKind::Integer),
                    $column('failed_job_ids', ColumnKind::LongText),
                    $column('options', ColumnKind::MediumText, isNullable: true),
                    $column('cancelled_at', ColumnKind::Integer, isNullable: true),
                    $column('created_at', ColumnKind::Integer),
                    $column('finished_at', ColumnKind::Integer, isNullable: true),
                ],
            ],
            [
                'name' => 'failed_jobs',
                'columns' => [
                    $column('id', ColumnKind::Id, keys: [ColumnKeyKind::Primary]),
                    $column('uuid', ColumnKind::String, ['length' => 255], keys: [ColumnKeyKind::Unique]),
                    $column('connection', ColumnKind::String, ['length' => 255]),
                    $column('queue', ColumnKind::String, ['length' => 255]),
                    $column('payload', ColumnKind::LongText),
                    $column('exception', ColumnKind::LongText),
                    $column('failed_at', ColumnKind::Timestamp),
                ],
            ],
        ],
    ],
];
