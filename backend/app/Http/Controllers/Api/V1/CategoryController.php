<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Services\CategoryService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class CategoryController extends Controller
{
    public function __construct(private readonly CategoryService $categories) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return CategoryResource::collection($this->categories->list($request->user()));
    }

    public function store(CategoryRequest $request): CategoryResource
    {
        return new CategoryResource($this->categories->create($request->user(), $request->toInput()));
    }

    public function update(CategoryRequest $request, int $category): CategoryResource
    {
        return new CategoryResource($this->categories->update($request->user(), $category, $request->toInput()));
    }

    public function destroy(Request $request, int $category): Response
    {
        $this->categories->delete($request->user(), $category);

        return response()->noContent();
    }
}
