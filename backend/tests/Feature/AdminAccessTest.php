<?php

use App\Http\AdminAccess;

beforeEach(fn () => config(['subs.admin_domain' => 'admin.unsab.com', 'subs.admin_emails' => ['me@example.com']]));

it('opens Horizon on the admin host for an allowed Access email', function () {
    $this->get('http://admin.unsab.com/horizon', [AdminAccess::EMAIL_HEADER => 'me@example.com'])->assertOk();
});

it('refuses Horizon without the Access header, for another email, or on another host', function (string $url, array $headers) {
    $this->get($url, $headers)->assertForbidden();
})->with([
    'no header' => ['http://admin.unsab.com/horizon', []],
    'other email' => ['http://admin.unsab.com/horizon', [AdminAccess::EMAIL_HEADER => 'someone@example.com']],
    'api host' => ['http://api.unsab.com/horizon', [AdminAccess::EMAIL_HEADER => 'me@example.com']],
]);

it('normalises ADMIN_EMAILS: trimmed, lowercased, blanks dropped', function () {
    putenv('ADMIN_EMAILS= Me@Example.com , ,Other@X.io');
    $config = require config_path('subs.php');
    putenv('ADMIN_EMAILS');

    expect($config['admin_emails'])->toBe(['me@example.com', 'other@x.io']);
});
