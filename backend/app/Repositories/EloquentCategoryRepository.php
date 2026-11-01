<?php

namespace App\Repositories;

use App\Data\CategoryInput;
use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

final class EloquentCategoryRepository implements CategoryRepository
{
    public function visibleTo(User $user): Collection
    {
        return Category::visibleTo($user)->orderByRaw('user_id IS NOT NULL')->orderBy('id')->get();
    }

    public function findVisibleOrFail(User $user, int $id): Category
    {
        return Category::visibleTo($user)->findOrFail($id);
    }

    public function other(): Category
    {
        return Category::query()->whereNull('user_id')->where('key', 'other')->firstOrFail();
    }

    public function create(User $user, CategoryInput $input): Category
    {
        return $user->categories()->create($input->toArray());
    }

    public function update(Category $category, CategoryInput $input): void
    {
        $category->update($input->toArray());
    }

    public function delete(Category $category): void
    {
        $category->delete();
    }
}
