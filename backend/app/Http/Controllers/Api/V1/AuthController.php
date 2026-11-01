<?php

namespace App\Http\Controllers\Api\V1;

use App\Data\IssuedToken;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        return $this->tokenResponse($this->auth->register($request->toInput()), 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        return $this->tokenResponse($this->auth->login($request->toInput()));
    }

    public function logout(Request $request): Response
    {
        $this->auth->logout($request->user());

        return response()->noContent();
    }

    private function tokenResponse(IssuedToken $issued, int $status = 200): JsonResponse
    {
        return response()->json(['token' => $issued->token, 'user' => new UserResource($issued->user)], $status);
    }
}
