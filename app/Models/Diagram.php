<?php

namespace App\Models;

use App\Enums\DiagramNodeType;
use Database\Factories\DiagramFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $team_id
 * @property string $name
 * @property array<string, mixed> $document
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Team $team
 */
#[Fillable(['name', 'document'])]
class Diagram extends Model
{
    /** @use HasFactory<DiagramFactory> */
    use HasFactory, SoftDeletes;

    /**
     * The document a diagram starts life with: an empty canvas.
     *
     * @return array<string, mixed>
     */
    public static function emptyDocument(): array
    {
        return [
            'version' => 1,
            'nodes' => [],
            'edges' => [],
            'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
        ];
    }

    /**
     * The people who keep this diagram on their own shortlist.
     *
     * @return BelongsToMany<User, $this>
     */
    public function starredBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'diagram_stars')->withTimestamps();
    }

    /**
     * How many tables and relations this diagram holds.
     *
     * Read from the stored document rather than counted anywhere else: the
     * document is the only place either of them exists.
     *
     * @return array{tables: int, relations: int}
     */
    public function contents(): array
    {
        $nodes = is_array($this->document['nodes'] ?? null) ? $this->document['nodes'] : [];
        $edges = is_array($this->document['edges'] ?? null) ? $this->document['edges'] : [];

        $tables = array_filter(
            $nodes,
            fn (mixed $node): bool => is_array($node)
                && ($node['type'] ?? null) === DiagramNodeType::Table->value,
        );

        return ['tables' => count($tables), 'relations' => count($edges)];
    }

    /**
     * Is there anything in this diagram a migration could be generated from?
     */
    public function hasTables(): bool
    {
        $nodes = $this->document['nodes'] ?? [];

        if (! is_array($nodes)) {
            return false;
        }

        foreach ($nodes as $node) {
            if (is_array($node) && ($node['type'] ?? null) === DiagramNodeType::Table->value) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the team that owns the diagram.
     *
     * @return BelongsTo<Team, $this>
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'document' => 'array',
            'version' => 'integer',
        ];
    }
}
