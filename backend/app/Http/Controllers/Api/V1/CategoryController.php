<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Models\Service;
use App\Models\Subscription;
use App\Services\DashboardCache;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return CategoryResource::collection(
            Category::visibleTo($request->user())->orderByRaw('user_id IS NOT NULL')->orderBy('id')->get()
        );
    }

    public function store(CategoryRequest $request): CategoryResource
    {
        return new CategoryResource($request->user()->categories()->create($request->validated()));
    }

    public function update(CategoryRequest $request, int $category): CategoryResource
    {
        $model = Category::visibleTo($request->user())->findOrFail($category);
        Gate::authorize('update', $model);
        $model->update($request->validated());

        return new CategoryResource($model);
    }

    public function destroy(Request $request, int $category): Response
    {
        $model = Category::visibleTo($request->user())->findOrFail($category);
        Gate::authorize('delete', $model);

        DB::transaction(function () use ($model) {
            $otherId = Category::other()->id;
            Subscription::withTrashed()->where('category_id', $model->id)->update(['category_id' => $otherId]);
            Service::where('default_category_id', $model->id)->update(['default_category_id' => $otherId]);
            $model->delete();
        });

        DashboardCache::forget($request->user());

        return response()->noContent();
    }
}
