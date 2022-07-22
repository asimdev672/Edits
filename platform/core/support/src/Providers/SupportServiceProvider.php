<?php

namespace Botble\Support\Providers;

use File;
use Illuminate\Contracts\Filesystem\FileNotFoundException;
use Illuminate\Support\ServiceProvider;

class SupportServiceProvider extends ServiceProvider
{
    /**
     * @throws FileNotFoundException
     */
    public function register()
    {
        File::requireOnce(core_path('support/helpers/common.php'));
    }
}
