<?php
/**
 * Web-only Yii Application Config.
 *
 * Merged into the app config for HTTP requests (not console).
 * https://craftcms.com/docs/5.x/configure.html#application-configuration
 */

use craft\helpers\App;

return [
    'components' => [
        // Trust X-Forwarded-* headers from Cloudflare Tunnel. The cloudflared
        // container forwards requests to `nginx:80` over the internal Docker
        // network (172.16.0.0/12) on plain HTTP; TLS is terminated at the
        // Cloudflare edge. Without these, Craft sees scheme=http and will
        // infinite-redirect to https.
        //
        // 'trustedHosts' is intentionally permissive because the nginx
        // container is only reachable via the cloudflared sidecar on the
        // private Docker network — no public ingress exists.
        // https://www.yiiframework.com/doc/api/2.0/yii-web-request#$trustedHosts-detail
        //
        // We respecify Craft's default request wiring below because declaring
        // a custom `request` entry in user config disables Craft's defaults
        // entirely (the component config is not deep-merged). Without this,
        // cookie validation, CSRF, and JSON body parsing all break — e.g.
        // the Craft CP login form POSTs application/json, and without the
        // JsonParser registered, every submit fails with
        // "Request missing required body param".
        // See vendor/craftcms/cms/src/config/app.web.php for Craft's defaults.
        'request' => [
            'class' => craft\web\Request::class,
            'enableCookieValidation' => true,
            'cookieValidationKey' => App::env('SECURITY_KEY'),
            'enableCsrfValidation' => true,
            'enableCsrfCookie' => true,
            'parsers' => [
                'application/json' => yii\web\JsonParser::class,
            ],
            'trustedHosts' => ['any'],
            'secureHeaders' => [
                'X-Forwarded-For',
                'X-Forwarded-Host',
                'X-Forwarded-Proto',
                'X-Forwarded-Port',
                'Front-End-Https',
                'Cf-Connecting-Ip',
                'Cf-Visitor',
            ],
            'secureProtocolHeaders' => [
                'X-Forwarded-Proto' => ['https'],
                'Front-End-Https' => ['on'],
                'Cf-Visitor' => ['{"scheme":"https"}'],
            ],
        ],
    ],
];
