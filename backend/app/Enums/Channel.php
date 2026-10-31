<?php

namespace App\Enums;

enum Channel: string
{
    case Push = 'push';
    case InApp = 'in_app';
    case Email = 'email';
}
