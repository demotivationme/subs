<?php

namespace App\Repositories;

use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

final class EloquentServiceRepository implements ServiceRepository
{
    public function search(User $user, ?string $query, int $limit): Collection
    {
        return Service::visibleTo($user)
            ->when($query, fn ($q) => $q->where('name', 'ilike', '%'.addcslashes($query, '%_\\').'%'))
            ->orderByRaw('user_id IS NULL')
            ->orderBy('name')
            ->limit($limit)
            ->get();
    }

    public function findVisibleByName(User $user, string $name): ?Service
    {
        return Service::query()
            ->visibleTo($user)
            ->whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->orderByRaw('user_id IS NOT NULL')
            ->first();
    }

    public function findOrFail(int $id): Service
    {
        return Service::findOrFail($id);
    }

    public function create(User $user, string $name, int $defaultCategoryId, ?string $color = null): Service
    {
        return $user->services()->create(['name' => $name, 'default_category_id' => $defaultCategoryId, 'color' => $color]);
    }

    public function findVisibleOrFail(User $user, int $id): Service
    {
        return Service::visibleTo($user)->findOrFail($id);
    }

    public function update(Service $service, array $attributes): void
    {
        $service->update($attributes);
    }

    public function logoPathsOwnedBy(User $user): array
    {
        return $user->services()->whereNotNull('logo_path')->pluck('logo_path')->all();
    }

    public function reassignDefaultCategory(int $fromCategoryId, int $toCategoryId): void
    {
        Service::where('default_category_id', $fromCategoryId)->update(['default_category_id' => $toCategoryId]);
    }
}
