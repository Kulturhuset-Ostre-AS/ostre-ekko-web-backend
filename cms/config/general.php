<?php
/**
 * General Configuration
 *
 * All of your system's general configuration settings go in here. You can see a
 * list of the available settings in vendor/craftcms/cms/src/config/GeneralConfig.php.
 *
 * @see \craft\config\GeneralConfig
 */

use craft\helpers\App;

$gcsAssetBaseUrl = rtrim((string) (App::env('GCS_ASSET_BASE_URL') ?: ''), '/');

return [
    // Global settings
    '*' => [
        // Headless mode: site is served to a separate frontend via GraphQL.
        // Disables Twig template routing, forces JSON responses from
        // controller endpoints, and keeps element URLs as absolute base URLs
        // rather than rendered template paths. See
        // https://craftcms.com/docs/4.x/config/general.html#headlessmode.
        'headlessMode' => true,

        // Default Week Start Day (0 = Sunday, 1 = Monday...)
        'defaultWeekStartDay' => 1,

        // Whether generated URLs should omit "index.php"
        'omitScriptNameInUrls' => true,

        // Control Panel trigger word
        'cpTrigger' => 'admin',

        // The secure key Craft will use for hashing and encrypting data
        'securityKey' => App::env('SECURITY_KEY'),

        'aliases' => [
            '@web' => App::env('SITE_URL'),
            '@webroot' => dirname(__DIR__, 2) . '/public_html',
            '@assetBaseUrl' => App::env('SITE_URL').'/uploads',
            '@assetBasePath' => '@webroot/uploads',
            // craftcms/google-cloud filesystems (see docs/gcs-craft-plugin.md)
            '@gcsProjectId' => App::env('GCP_PROJECT_ID') ?: '',
            '@gcsAssetsBucket' => App::env('GCS_ASSETS_BUCKET') ?: '',
            '@gcsKeyFileJson' => App::env('GCS_KEY_FILE_JSON') ?: '',
            '@gcsAssetBaseUrl' => $gcsAssetBaseUrl,
            '@gcsUrlArtistPhotos' => $gcsAssetBaseUrl !== '' ? $gcsAssetBaseUrl . '/uploads/photos/artists' : '',
            '@gcsUrlEventPhotos' => $gcsAssetBaseUrl !== '' ? $gcsAssetBaseUrl . '/uploads/photos/events' : '',
            '@gcsUrlMixtapes' => $gcsAssetBaseUrl !== '' ? $gcsAssetBaseUrl . '/uploads/mixtapes' : '',
        ],

        'convertFilenamesToAscii' => true,
        'limitAutoSlugsToAscii' => true,
        'sanitizeSvgUploads' => false,
        'transformGifs' => false
    ],

    // Dev environment settings
    'dev' => [
        // Dev Mode (see https://craftcms.com/guides/what-dev-mode-does)
        'devMode' => true,
        'enableTemplateCaching' => false,
    ],

    // Staging environment settings
    'staging' => [
        // Set this to `false` to prevent administrative changes from being made on staging
        'allowAdminChanges' => false,
    ],

    // Production environment settings
    'production' => [
        // Set this to `false` to prevent administrative changes from being made on production
        'allowAdminChanges' => true,
    ],
];
