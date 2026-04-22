<?php

return [
    '*' => [
        'manifestPath' => '@webroot/rev-manifest.json',
    ],
  
    'dev' => [
      'pipeline' => 'passthrough',
      'assetUrlPrefix' => '@web/local/',
    ],

    'production' => [
      'assetUrlPrefix' => '@web/assets/',
    ]
];