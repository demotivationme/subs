<?php

namespace App\Repositories;

use App\Data\CategoryInput;
use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/** Preset (global) categories and users' custom ones. */
interface CategoryRepository
{
    /** @return Collection<int, Category> presets first, then the user's own, each in id order */
    public function visibleTo(User $user): Collection;

    /** A preset or one of the user's own; 404 otherwise. */
    public function findVisibleOrFail(User $user, int $id): Category;

    /** The preset "Other" category, the fallback for everything uncategorised. */
    public function other(): Category;

    public function create(User $user, CategoryInput $input): Category;

    public function update(Category $category, CategoryInput $input): void;

    public function delete(Category $category): void;
}
