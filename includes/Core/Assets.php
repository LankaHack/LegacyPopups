<?php

declare(strict_types=1);

namespace LegacyPopups\Core;

use LegacyPopups\Domain\PopupRepository;
use LegacyPopups\Frontend\PreviewController;
use LegacyPopups\Frontend\PopupResolver;
use LegacyPopups\Frontend\RequestContext;
use LegacyPopups\Frontend\RuntimePayloadBuilder;

final class Assets
{
    public const ADMIN_PAGE_HOOK = 'toplevel_page_legacy-popups';

    public const ADMIN_SCRIPT_HANDLE = 'legacypopups-admin-app';

    public const ADMIN_STYLE_HANDLE = 'legacypopups-admin-app';

    public const FRONTEND_SCRIPT_HANDLE = 'legacypopups-frontend-runtime';

    public const FRONTEND_STYLE_HANDLE = 'legacypopups-frontend-runtime';

    private PopupRepository $popup_repository;

    private RuntimePayloadBuilder $runtime_payload_builder;

    private PopupResolver $popup_resolver;

    public function __construct(
        PopupRepository $popup_repository,
        ?RuntimePayloadBuilder $runtime_payload_builder = null,
        ?PopupResolver $popup_resolver = null
    )
    {
        $this->popup_repository        = $popup_repository;
        $this->runtime_payload_builder = $runtime_payload_builder ?? new RuntimePayloadBuilder();
        $this->popup_resolver          = $popup_resolver ?? new PopupResolver();
    }

    public function register_hooks(): void
    {
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_assets'));
    }

    public function enqueue_admin_assets(string $hook_suffix = ''): void
    {
        if (self::ADMIN_PAGE_HOOK !== $hook_suffix) {
            return;
        }

        wp_enqueue_style(
            self::ADMIN_STYLE_HANDLE,
            LEGACY_POPUPS_URL . 'assets/admin/css/app.css',
            array(),
            LEGACY_POPUPS_VERSION
        );

        wp_enqueue_script(
            self::ADMIN_SCRIPT_HANDLE,
            LEGACY_POPUPS_URL . 'assets/admin/js/app.js',
            array('wp-element', 'wp-i18n'),
            LEGACY_POPUPS_VERSION,
            true
        );

        wp_set_script_translations(
            self::ADMIN_SCRIPT_HANDLE,
            'legacy-popups'
        );

        wp_localize_script(
            self::ADMIN_SCRIPT_HANDLE,
            'LegacyPopupsAdmin',
            array(
                'restUrl'   => esc_url_raw(rest_url('legacypopups/v1/')),
                'restRoot'  => esc_url_raw(rest_url()),
                'nonce'     => wp_create_nonce('wp_rest'),
                'adminUrl'  => esc_url_raw(admin_url()),
                'pluginUrl' => esc_url_raw(LEGACY_POPUPS_URL),
                'version'   => LEGACY_POPUPS_VERSION,
                'locale'    => get_user_locale(),
            )
        );
    }

    public function enqueue_frontend_assets(): void
    {
        $tracking_enabled = (bool) apply_filters('legacypopups_tracking_enabled', true) && ! PreviewController::is_preview_request();

        if (is_admin()) {
            return;
        }

        $popups = $this->popup_repository->find_active_for_frontend();

        if (empty($popups)) {
            return;
        }

        $popups = $this->popup_resolver->resolve($popups, RequestContext::from_globals());

        if (empty($popups)) {
            return;
        }

        $payloads = $this->runtime_payload_builder->build_many($popups);

        if (empty($payloads)) {
            return;
        }

        wp_enqueue_style(
            self::FRONTEND_STYLE_HANDLE,
            LEGACY_POPUPS_URL . 'assets/frontend/css/runtime.css',
            array(),
            LEGACY_POPUPS_VERSION
        );

        wp_enqueue_script(
            self::FRONTEND_SCRIPT_HANDLE,
            LEGACY_POPUPS_URL . 'assets/frontend/js/runtime.js',
            array(),
            LEGACY_POPUPS_VERSION,
            true
        );

        wp_add_inline_script(
            self::FRONTEND_SCRIPT_HANDLE,
            'window.LegacyPopupsFrontend = ' . wp_json_encode(
                array(
                    'popups' => $payloads,
                    'tracking' => array(
                        'enabled'           => $tracking_enabled,
                        'endpoint'          => esc_url_raw(rest_url('legacypopups/v1/analytics/event')),
                        'nonce'             => wp_create_nonce('legacypopups_track'),
                        'respectDoNotTrack' => (bool) apply_filters('legacypopups_tracking_respect_dnt', true),
                        'sessionKey'        => 'legacypopups:tracking:session',
                        'visitorKey'        => 'legacypopups:tracking:visitor',
                        'cookieFallback'    => true,
                    ),
                    'i18n'   => array(
                        'closeLabel' => __('Popup schliessen', 'legacy-popups'),
                    ),
                )
            ) . ';',
            'before'
        );
    }
}