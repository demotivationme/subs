<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = DB::transaction(function () use ($request) {
            $user = User::create($request->safe()->except('device_name'));
            $user->reminderRules()->create(config('subs.default_reminder'));

            return $user;
        });

        event(new Registered($user));

        return response()->json([
            'token' => $user->createToken($request->input('device_name'))->plainTextToken,
            'user' => new UserResource($user->refresh()),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::firstWhere('email', Str::lower($request->input('email')));

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        return response()->json([
            'token' => $user->createToken($request->input('device_name'))->plainTextToken,
            'user' => new UserResource($user),
        ]);
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }
}
