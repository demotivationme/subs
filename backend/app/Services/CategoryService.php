<?php

namespace App\Services;

use App\Data\CategoryInput;
use App\Models\Category;
use App\Models\User;
use App\Repositories\CategoryRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\SubscriptionRepository;
use App\Repositories\TransactionRunner;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Gate;

final class CategoryService
{
    public function __construct(
        private readonly CategoryRepository $categories,
        private readonly ServiceRepository $services,
        private readonly SubscriptionRepository $subscriptions,
        private readonly TransactionRunner $transactions,
    ) {}

    /** @return Collection<int, Category> */
    public function list(User $user): Collection
    {
        return $this->categories->visibleTo($user);
    }

    public function create(User $user, CategoryInput $input): Category
    {
        return $this->categories->create($user, $input);
    }

    /** Only the user's own categories can change; presets answer 403, others' 404. */
    public function update(User $user, int $id, CategoryInput $input): Category
    {
        $category = $this->categories->findVisibleOrFail($user, $id);
        Gate::forUser($user)->authorize('update', $category);
        $this->categories->update($category, $input);

        return $category;
    }

    /** Moves everything in the category, deleted subscriptions included, to "Other" first. */
    public function delete(User $user, int $id): void
    {
        $category = $this->categories->findVisibleOrFail($user, $id);
        Gate::forUser($user)->authorize('delete', $category);

        $this->transactions->run(function () use ($category) {
            $otherId = $this->categories->other()->id;
            $this->subscriptions->reassignCategory($category->id, $otherId);
            $this->services->reassignDefaultCategory($category->id, $otherId);
            $this->categories->delete($category);
        });

        DashboardCache::forget($user);
    }
}
