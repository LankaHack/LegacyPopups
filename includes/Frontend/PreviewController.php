<?php

declare(strict_types=1);

namespace LegacyPopups\Frontend;

use LegacyPopups\Domain\PopupRepository;

final class PreviewController
{
    private const POPUP_QUERY_ARG = 'legacypopups_preview';
    private const NONCE_QUERY_ARG = '_lp_preview_nonce';

    private PopupRepository $popup_repository;

    private PopupPreviewRenderer $renderer;

    public function __construct(PopupRepository $popup_repository, ?PopupPreviewRenderer $renderer = null)
    {
        $this->popup_repository = $popup_repository;
        $this->renderer         = $renderer ?? new PopupPreviewRenderer();
    }

    public function register_hooks(): void
    {
        add_action('template_redirect', array($this, 'maybe_render_preview'));
    }

    public static function is_preview_request(): bool
    {
        $popup_id = isset($_GET[self::POPUP_QUERY_ARG]) ? absint(wp_unslash($_GET[self::POPUP_QUERY_ARG])) : 0;

        return $popup_id > 0;
    }

    public static function get_preview_url(int $popup_id): string
    {
        if ($popup_id <= 0 || ! is_user_logged_in()) {
            return '';
        }

        return esc_url_raw(
            add_query_arg(
                array(
                    self::POPUP_QUERY_ARG => $popup_id,
                    self::NONCE_QUERY_ARG => wp_create_nonce(self::nonce_action($popup_id)),
                ),
                home_url('/')
            )
        );
    }

    public function maybe_render_preview(): void
    {
        $popup_id = isset($_GET[self::POPUP_QUERY_ARG]) ? absint(wp_unslash($_GET[self::POPUP_QUERY_ARG])) : 0;

        if ($popup_id <= 0) {
            return;
        }

        $nonce = isset($_GET[self::NONCE_QUERY_ARG]) ? sanitize_text_field(wp_unslash($_GET[self::NONCE_QUERY_ARG])) : '';

        if (! is_user_logged_in() || '' === $nonce || ! wp_verify_nonce($nonce, self::nonce_action($popup_id)) || ! current_user_can('edit_post', $popup_id)) {
            status_header(403);
            wp_die(
                esc_html__('Diese Popup-Vorschau ist nicht verfuegbar.', 'legacy-popups'),
                esc_html__('LegacyPopups Vorschau', 'legacy-popups'),
                array('response' => 403)
            );
        }

        $popup = $this->popup_repository->load($popup_id);

        if (null === $popup) {
            status_header(404);
            wp_die(
                esc_html__('Das angeforderte Popup wurde nicht gefunden.', 'legacy-popups'),
                esc_html__('LegacyPopups Vorschau', 'legacy-popups'),
                array('response' => 404)
            );
        }

        status_header(200);
        $this->renderer->render_document($popup);
        exit;
    }

    private static function nonce_action(int $popup_id): string
    {
        return 'legacypopups_preview_' . $popup_id;
    }
}