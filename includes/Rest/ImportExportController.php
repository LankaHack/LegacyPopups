<?php

declare(strict_types=1);

namespace LegacyPopups\Rest;

use InvalidArgumentException;
use LegacyPopups\Domain\ImportExportService;
use LegacyPopups\Domain\PopupEntity;
use LegacyPopups\Frontend\PreviewController;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

final class ImportExportController
{
    private const REST_NAMESPACE = 'legacypopups/v1';

    private ImportExportService $import_export_service;

    public function __construct(ImportExportService $import_export_service)
    {
        $this->import_export_service = $import_export_service;
    }

    public function register_routes(): void
    {
        register_rest_route(
            self::REST_NAMESPACE,
            '/export/(?P<id>\d+)',
            array(
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array($this, 'export_popup'),
                    'permission_callback' => array($this, 'can_export_popup'),
                    'args'                => $this->id_args(),
                ),
            )
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/import',
            array(
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array($this, 'import_popup'),
                    'permission_callback' => array($this, 'can_import_popup'),
                    'args'                => $this->import_args(),
                ),
            )
        );
    }

    public function export_popup(WP_REST_Request $request)
    {
        try {
            $document = $this->import_export_service->export_popup((int) $request->get_param('id'));
        } catch (InvalidArgumentException $exception) {
            return new WP_Error(
                'legacypopups_export_popup_not_found',
                $exception->getMessage(),
                array('status' => 404)
            );
        }

        $response = new WP_REST_Response($document, 200);
        $response->header('Content-Disposition', 'attachment; filename="' . $this->suggested_filename($document) . '"');

        return $response;
    }

    public function import_popup(WP_REST_Request $request)
    {
        $document = $request->get_json_params();

        if (! is_array($document) || array() === $document) {
            $document = $request->get_params();
        }

        try {
            $popup = $this->import_export_service->import_popup(is_array($document) ? $document : array());
        } catch (InvalidArgumentException $exception) {
            return new WP_Error(
                'legacypopups_import_invalid_payload',
                $exception->getMessage(),
                array('status' => 400)
            );
        }

        return new WP_REST_Response(
            array(
                'imported' => true,
                'popup'    => $this->prepare_popup_response($popup),
            ),
            201
        );
    }

    public function can_export_popup(WP_REST_Request $request)
    {
        return $this->can_edit($request, (int) $request->get_param('id'));
    }

    public function can_import_popup(WP_REST_Request $request)
    {
        return $this->can_edit($request, 0);
    }

    private function can_edit(WP_REST_Request $request, int $popup_id)
    {
        $nonce = $request->get_header('X-WP-Nonce');

        if (! is_string($nonce) || '' === $nonce) {
            $nonce = $request->get_param('_wpnonce');
        }

        if (! is_string($nonce) || ! wp_verify_nonce($nonce, 'wp_rest')) {
            return new WP_Error(
                'legacypopups_rest_invalid_nonce',
                __('Invalid or missing REST nonce.', 'legacy-popups'),
                array('status' => 403)
            );
        }

        if ($popup_id > 0) {
            return current_user_can('edit_post', $popup_id);
        }

        return current_user_can('edit_posts');
    }

    private function prepare_popup_response(PopupEntity $popup): array
    {
        $response = $popup->to_array();
        $popup_id = $popup->id();
        $post = null !== $popup_id ? get_post($popup_id) : null;

        $response['edit_url'] = null !== $popup_id ? esc_url_raw(admin_url('post.php?post=' . $popup_id . '&action=edit')) : '';
        $response['preview_url'] = null !== $popup_id ? PreviewController::get_preview_url($popup_id) : '';
        $response['modified_gmt'] = $post instanceof \WP_Post ? (string) $post->post_modified_gmt : '';
        $response['modified_human'] = $post instanceof \WP_Post
            ? get_date_from_gmt($post->post_modified_gmt, 'Y-m-d H:i:s')
            : '';

        return $response;
    }

    private function suggested_filename(array $document): string
    {
        $title = '';

        if (isset($document['popup']['title']) && is_string($document['popup']['title'])) {
            $title = sanitize_title($document['popup']['title']);
        }

        if ('' === $title) {
            $title = 'legacy-popup';
        }

        return $title . '.json';
    }

    private function id_args(): array
    {
        return array(
            'id' => array(
                'required'          => true,
                'validate_callback' => static function ($value): bool {
                    return is_numeric($value) && (int) $value > 0;
                },
                'sanitize_callback' => 'absint',
            ),
        );
    }

    private function import_args(): array
    {
        return array(
            'format' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || is_string($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'version' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || is_numeric($value);
                },
                'sanitize_callback' => 'absint',
            ),
            'popup' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || is_array($value);
                },
            ),
        );
    }
}