<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class EmailVerificationController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    public function verify(int $id, string $hash): RedirectResponse
    {
        $this->auth->verifyEmail($id, $hash);

        return redirect()->away(config('subs.frontend_url').'/?verified=1');
    }

    public function resend(Request $request): Response
    {
        $this->auth->resendVerification($request->user());

        return response()->noContent();
    }
}
