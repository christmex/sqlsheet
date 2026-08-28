<?php

use App\Enums\ColumnKind;
use Illuminate\Support\Facades\File;

/**
 * The canvas decides on its own which columns may default to the current time,
 * because it has to hide the choice before anything is sent anywhere. That makes
 * two copies of one list, and the copy nobody re-reads is the one that drifts —
 * which is how a preset column once turned from `bigInteger` into `integer`.
 */
test('the kinds the canvas offers the current time on are the kinds the exporter honours', function () {
    $source = File::get(resource_path('js/lib/erd.ts'));

    expect($source)->toMatch('/kindsAcceptingCurrentTimestamp: ColumnKind\[\] = \[/');

    preg_match(
        '/kindsAcceptingCurrentTimestamp: ColumnKind\[\] = \[(.*?)\];/s',
        $source,
        $declaration,
    );

    preg_match_all("/'([A-Za-z]+)'/", $declaration[1], $listed);

    $offeredOnTheCanvas = $listed[1];

    $honouredByTheExporter = collect(ColumnKind::cases())
        ->filter(fn (ColumnKind $kind): bool => $kind->supportsCurrentTimestampDefault())
        ->map(fn (ColumnKind $kind): string => $kind->value)
        ->values()
        ->all();

    sort($offeredOnTheCanvas);
    sort($honouredByTheExporter);

    expect($offeredOnTheCanvas)->toBe($honouredByTheExporter);
});
