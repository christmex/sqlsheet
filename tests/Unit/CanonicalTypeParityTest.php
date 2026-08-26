<?php

use App\Enums\ColumnKeyKind;
use App\Enums\ColumnKind;
use App\Enums\DiagramNodeType;
use App\Enums\RelationCardinality;
use App\Http\Requests\Diagrams\UpdateDiagramDocumentRequest;

/**
 * Read the TypeScript file that mirrors the PHP enums.
 */
function typeScriptDiagramTypes(): string
{
    return file_get_contents(dirname(__DIR__, 2).'/resources/js/types/erd.ts');
}

/**
 * Pull the string literals out of one exported TypeScript union.
 *
 * @return array<int, string>
 */
function typeScriptUnionValues(string $typeName): array
{
    $source = typeScriptDiagramTypes();
    $start = strpos($source, "export type {$typeName} =");

    expect($start)->not->toBeFalse("The TypeScript type {$typeName} is missing.");

    $declaration = substr($source, $start, strpos($source, ';', $start) - $start);

    preg_match_all("/'([^']+)'/", $declaration, $matches);

    return $matches[1];
}

test('the column kinds PHP knows about are exactly the ones TypeScript offers', function () {
    $typeScriptKinds = typeScriptUnionValues('ColumnKind');

    expect($typeScriptKinds)->not->toBeEmpty();
    sort($typeScriptKinds);

    $phpKinds = ColumnKind::values();
    sort($phpKinds);

    expect($typeScriptKinds)->toBe($phpKinds);
});

test('every node type PHP knows about exists in the TypeScript types', function () {
    $typeScriptSource = typeScriptDiagramTypes();

    foreach (DiagramNodeType::values() as $nodeType) {
        expect($typeScriptSource)->toContain("type: '{$nodeType}'");
    }
});

test('the relation cardinalities PHP knows about are exactly the ones TypeScript offers', function () {
    $typeScriptCardinalities = typeScriptUnionValues('RelationCardinality');
    sort($typeScriptCardinalities);

    $phpCardinalities = RelationCardinality::values();
    sort($phpCardinalities);

    expect($typeScriptCardinalities)->toBe($phpCardinalities);
});

test('the column key kinds PHP knows about are exactly the ones TypeScript offers', function () {
    $typeScriptKeys = typeScriptUnionValues('ColumnKeyKind');
    sort($typeScriptKeys);

    $phpKeys = ColumnKeyKind::values();
    sort($phpKeys);

    expect($typeScriptKeys)->toBe($phpKeys);
});

test('the canvas stops at the same ceilings the server accepts', function () {
    $typeScript = file_get_contents(dirname(__DIR__, 2).'/resources/js/lib/erd.ts');

    $ceilings = [
        'maximumNodesPerDiagram' => UpdateDiagramDocumentRequest::MAXIMUM_NODES,
        'maximumEdgesPerDiagram' => UpdateDiagramDocumentRequest::MAXIMUM_EDGES,
    ];

    foreach ($ceilings as $constant => $enforced) {
        preg_match('/export const '.$constant.' = (\d+);/', $typeScript, $matches);

        expect($matches[1] ?? null)->not->toBeNull("The canvas has no {$constant}.")
            ->and((int) $matches[1])->toBe($enforced);
    }
});
