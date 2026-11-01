<?php

namespace App\Repositories;

use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/** Catalog (global) services and users' own. */
interface ServiceRepository
{
    /** @return Collection<int, Service> the user's own first, then the catalog, by name; $query matches names */
    public function search(User $user, ?string $query, int $limit): Collection;

    /** Case-insensitive exact name match, catalog first. */
    public function findVisibleByName(User $user, string $name): ?Service;

    public function findOrFail(int $id): Service;

    public function create(User $user, string $name, int $defaultCategoryId): Service;

    /** Points every service defaulting to $fromCategoryId at $toCategoryId. */
    public function reassignDefaultCategory(int $fromCategoryId, int $toCategoryId): void;
}
