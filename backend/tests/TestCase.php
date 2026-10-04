<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;

abstract class TestCase extends BaseTestCase
{
    protected bool $authenticate = true;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.bot.token' => str_repeat('t', 64)]);
        $this->withHeaders(['Authorization' => 'Bearer '.str_repeat('t', 64)]);
        if ($this->authenticate && Schema::hasTable('users')) {
            $this->actingAs(User::factory()->create(['role' => 'admin', 'active' => true]));
        }
    }
}
