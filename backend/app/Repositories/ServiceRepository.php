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

    public function create(User $user, string $name, int $defaultCategoryId, ?string $color = null): Service;

    /** A catalog service or one of the user's own; anyone else's is not found. */
    public function findVisibleOrFail(User $user, int $id): Service;

    /** @param array<string, mixed> $attributes */
    public function update(Service $service, array $attributes): void;

    /** @return list<string> the uploaded logo files of the user's own services */
    public function logoPathsOwnedBy(User $user): array;

    /** Points every service defaulting to $fromCategoryId at $toCategoryId. */
    public function reassignDefaultCategory(int $fromCategoryId, int $toCategoryId): void;
}
