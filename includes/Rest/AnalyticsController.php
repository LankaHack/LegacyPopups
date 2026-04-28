<?php

declare(strict_types=1);

namespace LegacyPopups\Rest;

use InvalidArgumentException;
use LegacyPopups\Domain\AnalyticsService;
use LegacyPopups\Domain\PopupRepository;
use RuntimeException;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

final class AnalyticsController
{
    private const REST_NAMESPACE = 'legacypopups/v1';

    private PopupRepository $popup_repository;

    private AnalyticsService $analytics_service;

    public function __construct(PopupRepository $popup_repository, AnalyticsService $analytics_service)
    {
        $this->popup_repository = $popup_repository;
        $this->analytics_service = $analytics_service;
    }

    public function register_routes(): void
    {
        register_rest_route(
            self::REST_NAMESPACE,
            '/analytics/event',
            array(
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array($this, 'record_event'),
                    'permission_callback' => array($this, 'can_track_event'),
                    'args'                => $this->event_args(),
                ),
            )
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/analytics/summary/(?P<id>\d+)',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array($this, 'get_summary'),
                    'permission_callback' => array($this, 'can_view_summary'),
                    'args'                => array_merge($this->id_args(), $this->summary_args()),
                ),
            )
        );
    }

    public function record_event(WP_REST_Request $request)
    {
        try {
            $result = $this->analytics_service->record_event(
                array(
                    'popup_id'      => $request->get_param('popup_id'),
                    'event_type'    => $request->get_param('event_type'),
                    'session_token' => $request->get_param('session_token'),
                    'visitor_token' => $request->get_param('visitor_token'),
                    'url'           => $request->get_param('url'),
                )
            );
        } catch (InvalidArgumentException $exception) {
            return new WP_Error(
                'legacypopups_invalid_analytics_event',
                $exception->getMessage(),
                array('status' => 400)
            );
        } catch (RuntimeException $exception) {
            return new WP_Error(
                'legacypopups_analytics_storage_error',
                $exception->getMessage(),
                array('status' => 500)
            );
        }

        return new WP_REST_Response($result, $result['accepted'] ? 202 : 200);
    }

    public function get_summary(WP_REST_Request $request)
    {
        try {
            $summary = $this->analytics_service->get_summary(
                (int) $request->get_param('id'),
                (string) $request->get_param('from'),
                (string) $request->get_param('to')
            );
        } catch (InvalidArgumentException $exception) {
            return new WP_Error(
                'legacypopups_analytics_popup_not_found',
                $exception->getMessage(),
                array('status' => 404)
            );
        } catch (RuntimeException $exception) {
            return new WP_Error(
                'legacypopups_analytics_summary_error',
                $exception->getMessage(),
                array('status' => 500)
            );
        }

        return new WP_REST_Response($summary, 200);
    }

    public function can_track_event(WP_REST_Request $request)
    {
        if (! $this->analytics_service->is_enabled()) {
            return new WP_Error(
                'legacypopups_analytics_disabled',
                __('Analytics tracking is disabled.', 'legacy-popups'),
                array('status' => 403)
            );
        }

        $nonce = $this->resolve_nonce($request);

        if ('' === $nonce || (! wp_verify_nonce($nonce, 'legacypopups_track') && ! wp_verify_nonce($nonce, 'wp_rest'))) {
            return new WP_Error(
                'legacypopups_analytics_invalid_nonce',
                __('Invalid analytics nonce.', 'legacy-popups'),
                array('status' => 403)
            );
        }

        return true;
    }

    public function can_view_summary(WP_REST_Request $request)
    {
        $nonce = $request->get_header('X-WP-Nonce');

        if (! is_string($nonce) || '' === $nonce) {
            $nonce = (string) $request->get_param('_wpnonce');
        }

        if ('' === $nonce || ! wp_verify_nonce($nonce, 'wp_rest')) {
            return new WP_Error(
                'legacypopups_analytics_summary_invalid_nonce',
                __('Invalid or missing REST nonce.', 'legacy-popups'),
                array('status' => 403)
            );
        }

        return current_user_can('edit_post', (int) $request->get_param('id'));
    }

    private function resolve_nonce(WP_REST_Request $request): string
    {
        $nonce = $request->get_header('X-LegacyPopups-Nonce');

        if (! is_string($nonce) || '' === $nonce) {
            $nonce = $request->get_header('X-WP-Nonce');
        }

        if (! is_string($nonce) || '' === $nonce) {
            $nonce = (string) $request->get_param('_lpnonce');
        }

        if ('' === $nonce) {
            $nonce = (string) $request->get_param('_wpnonce');
        }

        return is_string($nonce) ? $nonce : '';
    }

    private function event_args(): array
    {
        return array(
            'popup_id' => array(
                'required'          => true,
                'validate_callback' => static function ($value): bool {
                    return is_numeric($value) && (int) $value > 0;
                },
                'sanitize_callback' => 'absint',
            ),
            'event_type' => array(
                'required'          => true,
                'validate_callback' => static function ($value): bool {
                    return is_string($value) && in_array(sanitize_key($value), array('impression', 'close', 'click', 'conversion'), true);
                },
                'sanitize_callback' => 'sanitize_key',
            ),
            'session_token' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || is_string($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'visitor_token' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || is_string($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'url' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || is_string($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
            '_lpnonce' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || is_string($value);
                },
                'sanitize_callback' => 'sanitize_text_field',
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

    private function summary_args(): array
    {
        return array(
            'from' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value));
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'to' => array(
                'required'          => false,
                'validate_callback' => static function ($value): bool {
                    return null === $value || (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value));
                },
                'sanitize_callback' => 'sanitize_text_field',
            ),
        );
    }
}