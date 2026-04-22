<?php

/**
 * Configuration file for Imager
 */

return array(
    '*' => [
        'hashFilename' => false,
        'instanceReuseEnabled' => true,
        'removeMetadata' => true,
        'allowUpscale' => false,

        // Cache settings
        'cacheEnabled' => true,
    ],
    
    'dev' => [
        'suppressExceptions' => true,
    ]
);
