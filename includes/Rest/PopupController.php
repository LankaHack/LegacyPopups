<?php

declare(strict_types=1);

namespace LegacyPopups\Rest;

use LegacyPopups\Domain\BuilderSchema;
use LegacyPopups\Domain\PopupEntity;
use LegacyPopups\Domain\PopupMeta;
use LegacyPopups\Domain\PopupRepository;
use LegacyPopups\Domain\PopupStatus;
use LegacyPopups\Domain\PopupValueSanitizer;
use LegacyPopups\Frontend\PreviewController;
use RuntimeException;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

final class PopupController
{
    private const REST_NAMESPACE = 'legacypopups/v1';

    private PopupRepository $popup_repository;

    public function __construct(PopupRepository $popup_repository)
    {
        $this->popup_repository = $popup_repository;
    }

    public function register_routes(): void
    {
        register_rest_route(
            self::REST_NAMESPACE,
            '/popups',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array($this, 'list_popups'),
                    'permission_callback' => array($this, 'can_edit_popup'),
                    'args'                => $this->collection_args(),
                ),
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array($this, 'create_popup'),
                    'permission_callback' => array($this, 'can_edit_popup'),
                    'args'                => $this->popup_payload_args(false),
                ),
            )
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/popups/(?P<id>\d+)',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array($this, 'get_popup'),
                    'permission_callback' => array($this, 'can_edit_popup'),
                    'args'                => $this->id_args(),
                ),
                array(
                    'methods'             => WP_REST_Server::EDITABLE,
                    'callback'            => array($this, 'update_popup'),
                    'permission_callback' => array($this, 'can_edit_popup'),
                    'args'                => array_merge($this->id_args(), $this->popup_payload_args(true)),
                ),
                array(
                    'methods'             => WP_REST_Server::DELETABLE,
                    'callback'            => array($this, 'delete_popup'),
                    'permission_callback' => array($this, 'can_edit_popup'),
                    'args'                => $this->id_args(),
                ),
            )
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/popups/(?P<id>\d+)/duplicate',
            array(
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array($this, 'duplicate_popup'),
                    'permission_callback' => array($this, 'can_edit_popup'),
                    'args'                => $this->id_args(),
                ),
            )
        );
    }

    public function get_popup(WP_REST_Request $request)
    {
        $popup = $this->popup_repository->load((int) $request->get_param('id'));

        if ($popup === null) {
            return $this->not_found_error();
        }

        return new WP_REST_Response($this->prepare_popup_response($popup), 200);
    }

    public function list_popups(WP_REST_Request $request)
    {
        $results = $this->popup_repository->query(
            array(
                'search'       => (string) $request->get_param('search'),
                'popup_status' => (string) $request->get_param('popup_status'),
                'page'         => (int) $request->get_param('page'),
                'per_page'     => (int) $request->get_param('per_page'),
            )
        );

        return new WP_REST_Response(
            array(
                'items' => array_map(array($this, 'prepare_popup_response'), $results['items']),
                'meta'  => array(
                    'total'       => $results['total'],
                    'total_pages' => $results['total_pages'],
                    'page'        => $results['page'],
                    'per_page'    => $results['per_page'],
                ),
            ),
            200
        );
    }

    public function create_popup(WP_REST_Request $request)
    {
        try {
            $popup = $this->popup_repository->create($this->popup_from_request($request));
        } catch (RuntimeException $exception) {
            return $this->repository_error($exception);
        }

        return new WP_REST_Response($this->prepare_popup_response($popup), 201);
    }

    public function update_popup(WP_REST_Request $request)
    {
        $popup_id = (int) $request->get_param('id');
        $current  = $this->popup_repository->load($popup_id);

        if ($current === null) {
            return $this->not_found_error();
        }

        try {
            $popup = $this->popup_repository->update($this->popup_from_request($request, $current));
        } catch (RuntimeException $exception) {
            return $this->repository_error($exception);
        }

        return new WP_REST_Response($this->prepare_popup_response($popup), 200);
    }

    public function duplicate_popup(WP_REST_Request $request)
    {
        try {
            $popup = $this->popup_repository->duplicate((int) $request->get_param('id'));
        } catch (RuntimeException $exception) {
            return $this->repository_error($exception);
        }

        if ($popup === null) {
            return $this->not_found_error();
        }

        return new WP_REST_Response($this->prepare_popup_response($popup), 201);
    }

    public function delete_popup(WP_REST_Request $request)
    {
        $deleted = $this->popup_repository->delete((int) $request->get_param('id'));

        if (! $deleted) {
            return $this->not_found_error();
        }

        return new WP_REST_Response(array('deleted' => true), 200);
    }

    public function can_edit_popup(WP_REST_Request $request)
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

        $popup_id = (int) $request->get_param('id');

        if ($popup_id > 0) {
            return current_user_can('edit_post', $popup_id);
        }

        return current_user_can('edit_posts');
    }

    private function popup_from_request(WP_REST_Request $request, ?PopupEntity $current = null): PopupEntity
    {
        $payload = array(
            'id'               => $current ? $current->id() : null,
            'title'            => $request->get_param('title') ?? ($current ? $current->title() : ''),
            'post_status'      => $current ? $current->post_status() : 'draft',
            'popup_status'     => $request->get_param('popup_status') ?? ($current ? $current->popup_status() : PopupStatus::DRAFT),
            'builder_schema'   => $request->get_param('builder_schema') ?? ($current ? $current->builder_schema() : PopupMeta::default_builder_schema()),
            'trigger_schema'   => $request->get_param('trigger_schema') ?? ($current ? $current->trigger_schema() : PopupMeta::default_trigger_schema()),
            'targeting_schema' => $request->get_param('targeting_schema') ?? ($current ? $current->targeting_schema() : PopupMeta::default_targeting_schema()),
            'display_schema'   => $request->get_param('display_schema') ?? ($current ? $current->display_schema() : PopupMeta::default_display_schema()),
            'frequency_schema' => $request->get_param('frequency_schema') ?? ($current ? $current->frequency_schema() : PopupMeta::default_frequency_schema()),
            'schedule_from'    => $request->get_param('schedule_from') ?? ($current ? $current->schedule_from() : ''),
            'schedule_to'      => $request->get_param('schedule_to') ?? ($current ? $current->schedule_to() : ''),
        );

        return PopupEntity::from_array($payload);
    }

    private function prepare_popup_response(PopupEntity $popup): array
    {
        $response = $popup->to_array();
        $popup_id = $popup->id();
        $post     = null !== $popup_id ? get_post($popup_id) : null;

        $response['edit_url'] = null !== $popup_id ? esc_url_raw(admin_url('post.php?post=' . $popup_id . '&action=edit')) : '';
        $response['preview_url'] = null !== $popup_id ? PreviewController::get_preview_url($popup_id) : '';
        $response['modified_gmt'] = $post instanceof \WP_Post ? (string) $post->post_modified_gmt : '';
        $response['modified_human'] = $post instanceof \WP_Post
            ? get_date_from_gmt($post->post_modified_gmt, 'Y-m-d H:i:s')
            : '';

        return $response;
    }

    private function collection_args(): array
    {
        return array(
            'search' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return is_string($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'popup_status' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return '' === $value || (is_string($value) && PopupStatus::is_valid(PopupStatus::sanitize($value)));
                },
                'sanitize_callback' => static function ($value): string {
                    return is_string($value) ? PopupStatus::sanitize($value) : '';
                },
            ),
            'page' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return is_numeric($value) && (int) $value > 0;
                },
                'sanitize_callback' => 'absint',
                'default'           => 1,
            ),
            'per_page' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return is_numeric($value) && (int) $value > 0;
                },
                'sanitize_callback' => 'absint',
                'default'           => 50,
            ),
        );
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

    private function popup_payload_args(bool $for_update): array
    {
        return array(
            'title' => array(
                'required'          => ! $for_update,
                'validate_callback' => static function ($value): bool {
                    return is_string($value) && '' !== trim($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'popup_status' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return is_string($value) && PopupStatus::is_valid(PopupStatus::sanitize($value));
                },
                'sanitize_callback' => array(PopupStatus::class, 'sanitize'),
            ),
            'builder_schema' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return is_array($value);
                },
                'sanitize_callback' => array(BuilderSchema::class, 'sanitize_and_migrate'),
                'default'           => PopupMeta::default_builder_schema(),
            ),
            'trigger_schema' => $this->schema_arg(array(PopupMeta::class, 'default_trigger_schema'), array(PopupValueSanitizer::class, 'sanitize_trigger_schema')),
            'targeting_schema' => $this->schema_arg(array(PopupMeta::class, 'default_targeting_schema'), array(PopupValueSanitizer::class, 'sanitize_targeting_schema')),
            'display_schema' => $this->schema_arg(array(PopupMeta::class, 'default_display_schema'), array(PopupValueSanitizer::class, 'sanitize_display_schema')),
            'frequency_schema' => $this->schema_arg(array(PopupMeta::class, 'default_frequency_schema'), array(PopupValueSanitizer::class, 'sanitize_frequency_schema')),
            'schedule_from' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return is_string($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'schedule_to' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return is_string($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
        );
    }

    private function schema_arg(callable $default_callback, callable $sanitize_callback): array
    {
        return array(
            'required'          => false,
            'validate_callback' => static function ($value): bool {
                return is_array($value);
            },
            'sanitize_callback' => $sanitize_callback,
            'default'           => call_user_func($default_callback),
        );
    }

    private function not_found_error(): WP_Error
    {
        return new WP_Error(
            'legacypopups_rest_popup_not_found',
            __('Popup not found.', 'legacy-popups'),
            array('status' => 404)
        );
    }

    private function repository_error(RuntimeException $exception): WP_Error
    {
        return new WP_Error(
            'legacypopups_rest_repository_error',
            $exception->getMessage(),
            array('status' => 400)
        );
    }
}