<?php

return [
    'reminder' => [
        'title' => '{0} :service renews today|{1} :service renews tomorrow|[2,*] :service renews in :days days',
        'body' => ':amount on :date',
        'mail_subject' => ':service payment reminder',
        'mail_line' => 'Your :service subscription renews on :date for :amount.',
        'mail_action' => 'View subscription',
    ],
];
