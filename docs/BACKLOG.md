# Backlog

Work that has been deliberately deferred, so it is not rediscovered from scratch.
This lives in the repo because there is no git remote yet; move it to issues once
there is one.

## Features

### Preset table packs
A button that drops a project's usual starting tables onto the canvas in one go.

- **Laravel 13 core** — read from this repo's own skeleton, so it is verifiable rather
  than remembered: `users`, `password_reset_tokens`, `sessions` (one migration),
  `cache`, `cache_locks` (one migration), `jobs`, `job_batches`, `failed_jobs` (one
  migration). Earlier Laravel versions ship a different set — 10 and below have no
  `sessions` or `cache_locks` by default and split the files differently — so the
  picker names the version it is offering.
- **Package packs (Sanctum, Spatie Permission, and whatever else comes up)** — deferred.
  Their migrations live inside the packages and neither is installed here. These must be
  built by reading each package's actual published migration, never from memory: a
  column that is subtly wrong is worse than no preset at all, because it looks right.
- Adding a preset skips any table whose name is already on the canvas rather than
  overwriting it.

### Export the canvas as PNG and SVG
Item 8 of the original brief. Needs `html-to-image`, which is already on the approved
package list.

### Column default values
The document already stores `defaultValue` per column and the migration exporter
already emits `->default(...)`, but nothing in the editor shows or sets it.

### Table header colour
Assigned automatically from a palette by table count; there is no way to change it.
Same for the sticky note colour.

## Code health

- **The column kind list lives in five places** — `App\Enums\ColumnKind`, the `ColumnKind`
  and `ParameterlessColumnKind` unions in `resources/js/types/erd.ts`, and
  `columnKindSignatures` plus `columnKindGroups` in `resources/js/lib/erd.ts`. Adding a
  type means five edits. `tests/Unit/CanonicalTypeParityTest.php` only guards PHP against
  the first TypeScript union.
- **Three migrations produce one result** — `create_projects_table`,
  `create_diagrams_table` and `move_diagrams_under_teams`. All are unreleased, so they
  can still be folded into one.
- **Inline editing is written twice** — `editable-text.tsx` and `sticky-note-node.tsx`
  each implement draft, select-on-open, Escape-reverts and blur-commits separately.
- **Test fixtures are near-duplicates** — `tableNode`/`tableNodeFor` and
  `documentOfNodes`/`diagramDocument` across the diagram test files.
- **"A node is a table" is decided in three places** — `Diagram::hasTables()`,
  `GenerateDiagramMigrations::tablesByNodeId()` and
  `UpdateDiagramDocumentRequest::tableNodes()`.

## Deferred by the brief

Import from a SQL dump, read-only share links, versioning, auto-layout, undo/redo,
keyboard shortcuts, search and relation highlighting.
