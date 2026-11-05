<?php

namespace App\Http;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Who may open admin tools (Horizon now, the admin panel later): an ADMIN_EMAILS address that Cloudflare Access
 * vouched for, on the admin host only. Caddy refuses those paths on every other host.
 */
final class AdminAccess
{
    public const EMAIL_HEADER = 'Cf-Access-Authenticated-User-Email';

    public static function allows(Request $request): bool
    {
        if ($request->getHost() !== config('subs.admin_domain')) {
            return false;
        }

        $email = Str::lower(trim((string) $request->header(self::EMAIL_HEADER)));

        return $email !== '' && in_array($email, config('subs.admin_emails'), true);
    }
}
