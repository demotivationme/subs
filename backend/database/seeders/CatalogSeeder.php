<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([CategorySeeder::class, ServiceCatalogSeeder::class]);
    }
}
