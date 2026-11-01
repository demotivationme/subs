<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

class PasswordResetController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    public function forgot(ForgotPasswordRequest $request): JsonResponse
    {
        $this->auth->sendResetLink($request->email());

        // Same answer whether or not the account exists.
        return response()->json(['message' => __('passwords.sent')]);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        return response()->json(['message' => __($this->auth->resetPassword($request->toInput()))]);
    }
}
