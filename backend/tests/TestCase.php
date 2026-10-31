<?php

namespace Tests;

use Database\Seeders\CatalogSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Every feature test starts with the preset categories and service catalog. */
    protected $seed = true;

    protected $seeder = CatalogSeeder::class;
}
