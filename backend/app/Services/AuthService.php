<?php

namespace App\Services;

use App\Data\IssuedToken;
use App\Data\LoginInput;
use App\Data\PasswordResetInput;
use App\Data\RegisterInput;
use App\Data\ReminderRuleInput;
use App\Models\User;
use App\Repositories\ReminderRuleRepository;
use App\Repositories\TransactionRunner;
use App\Repositories\UserRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

final class AuthService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly ReminderRuleRepository $rules,
        private readonly TransactionRunner $transactions,
    ) {}

    /** Creates the account with the default reminder rule and signs it in. */
    public function register(RegisterInput $input): IssuedToken
    {
        $user = $this->transactions->run(function () use ($input) {
            $user = $this->users->create($input);
            $default = config('subs.default_reminder');
            $this->rules->save($user, null, new ReminderRuleInput(
                $default['days_before'], $default['time_of_day'], $default['channels'],
            ), null);

            return $user;
        });

        event(new Registered($user));

        return new IssuedToken($user->refresh(), $this->users->issueToken($user, $input->deviceName));
    }

    /** @throws ValidationException on a wrong email or password */
    public function login(LoginInput $input): IssuedToken
    {
        $user = $this->users->findByEmail($input->email);

        if (! $user || ! Hash::check($input->password, $user->password)) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        return new IssuedToken($user, $this->users->issueToken($user, $input->deviceName));
    }

    public function logout(User $user): void
    {
        $this->users->revokeCurrentToken($user);
    }

    /** @throws AuthorizationException when $hash does not match the user's email */
    public function verifyEmail(int $userId, string $hash): void
    {
        $user = $this->users->findOrFail($userId);

        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            throw new AuthorizationException;
        }

        if (! $user->hasVerifiedEmail() && $this->users->markEmailVerified($user)) {
            event(new Verified($user));
        }
    }

    public function resendVerification(User $user): void
    {
        if (! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }
    }

    /** Sends a reset link if the account exists; callers answer the same either way. */
    public function sendResetLink(string $email): void
    {
        Password::sendResetLink(['email' => mb_strtolower($email)]);
    }

    /**
     * Sets the new password and signs out every device.
     *
     * @return string the broker's status, a translation key
     *
     * @throws ValidationException on an invalid token or unknown email
     */
    public function resetPassword(PasswordResetInput $input): string
    {
        $status = Password::reset(
            ['email' => mb_strtolower($input->email), 'password' => $input->password, 'token' => $input->token],
            function (User $user, string $password) {
                $this->users->setPassword($user, $password);
                $this->users->revokeTokens($user);
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return $status;
    }
}
