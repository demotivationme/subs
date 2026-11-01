<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeleteAccountRequest;
use App\Http\Requests\UpdateMeRequest;
use App\Http\Resources\UserResource;
use App\Services\AccountService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class MeController extends Controller
{
    public function __construct(private readonly AccountService $account) {}

    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function update(UpdateMeRequest $request): UserResource
    {
        return new UserResource($this->account->update($request->user(), $request->toInput()));
    }

    public function destroy(DeleteAccountRequest $request): Response
    {
        $this->account->delete($request->user());

        return response()->noContent();
    }
}
