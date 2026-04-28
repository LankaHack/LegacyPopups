<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

use InvalidArgumentException;

final class ImportExportService
{
    public const DOCUMENT_FORMAT = 'legacypopups/popup';
    public const DOCUMENT_VERSION = 1;

    private PopupRepository $popup_repository;

    public function __construct(PopupRepository $popup_repository)
    {
        $this->popup_repository = $popup_repository;
    }

    public function export_popup(int $popup_id): array
    {
        $popup = $this->popup_repository->load($popup_id);

        if (null === $popup) {
            throw new InvalidArgumentException(__('Popup not found.', 'legacy-popups'));
        }

        return array(
            'format'      => self::DOCUMENT_FORMAT,
            'version'     => self::DOCUMENT_VERSION,
            'exported_at' => gmdate('c'),
            'source'      => array(
                'popup_id'       => $popup->id(),
                'popup_status'   => $popup->popup_status(),
                'site_url'       => home_url('/'),
                'plugin_version' => defined('LEGACY_POPUPS_VERSION') ? (string) LEGACY_POPUPS_VERSION : '',
            ),
            'popup'       => array(
                'title'            => $popup->title(),
                'builder_schema'   => $popup->builder_schema(),
                'trigger_schema'   => $popup->trigger_schema(),
                'targeting_schema' => $popup->targeting_schema(),
                'display_schema'   => $popup->display_schema(),
                'frequency_schema' => $popup->frequency_schema(),
                'schedule_from'    => $popup->schedule_from(),
                'schedule_to'      => $popup->schedule_to(),
            ),
        );
    }

    public function import_popup(array $document): PopupEntity
    {
        $payload = $this->validate_document($document);

        $payload['id'] = null;
        $payload['post_status'] = 'draft';
        $payload['popup_status'] = PopupStatus::DRAFT;

        return $this->popup_repository->create(PopupEntity::from_array($payload));
    }

    private function validate_document(array $document): array
    {
        $format = isset($document['format']) ? (string) $document['format'] : '';
        $version = isset($document['version']) ? (int) $document['version'] : 0;

        if (self::DOCUMENT_FORMAT !== $format) {
            throw new InvalidArgumentException(__('Invalid import format.', 'legacy-popups'));
        }

        if (self::DOCUMENT_VERSION !== $version) {
            throw new InvalidArgumentException(__('Unsupported import version.', 'legacy-popups'));
        }

        if (! isset($document['popup']) || ! is_array($document['popup'])) {
            throw new InvalidArgumentException(__('Import document must contain a popup payload.', 'legacy-popups'));
        }

        return $this->validate_popup_payload($document['popup']);
    }

    private function validate_popup_payload(array $popup): array
    {
        $title = isset($popup['title']) && is_string($popup['title'])
            ? sanitize_text_field($popup['title'])
            : '';

        if ('' === trim($title)) {
            throw new InvalidArgumentException(__('Imported popup title is required.', 'legacy-popups'));
        }

        $builder_schema = $this->require_array($popup, 'builder_schema', __('Builder schema is required.', 'legacy-popups'));
        $trigger_schema = $this->require_array($popup, 'trigger_schema', __('Trigger schema is required.', 'legacy-popups'));
        $targeting_schema = $this->require_array($popup, 'targeting_schema', __('Targeting schema is required.', 'legacy-popups'));
        $display_schema = $this->require_array($popup, 'display_schema', __('Display schema is required.', 'legacy-popups'));
        $frequency_schema = $this->require_array($popup, 'frequency_schema', __('Frequency schema is required.', 'legacy-popups'));

        $this->assert_builder_schema($builder_schema);
        $this->assert_group_schema($trigger_schema, __('Trigger schema must contain groups.', 'legacy-popups'));
        $this->assert_group_schema($targeting_schema, __('Targeting schema must contain groups.', 'legacy-popups'));
        $this->assert_display_schema($display_schema);
        $this->assert_frequency_schema($frequency_schema);

        return array(
            'title'            => $title,
            'builder_schema'   => BuilderSchema::sanitize_and_migrate($builder_schema),
            'trigger_schema'   => PopupValueSanitizer::sanitize_trigger_schema($trigger_schema),
            'targeting_schema' => PopupValueSanitizer::sanitize_targeting_schema($targeting_schema),
            'display_schema'   => PopupValueSanitizer::sanitize_display_schema($display_schema),
            'frequency_schema' => PopupValueSanitizer::sanitize_frequency_schema($frequency_schema),
            'schedule_from'    => $this->optional_string($popup, 'schedule_from'),
            'schedule_to'      => $this->optional_string($popup, 'schedule_to'),
        );
    }

    private function require_array(array $source, string $key, string $message): array
    {
        if (! array_key_exists($key, $source) || ! is_array($source[$key])) {
            throw new InvalidArgumentException($message);
        }

        return $source[$key];
    }

    private function optional_string(array $source, string $key): string
    {
        if (! array_key_exists($key, $source) || '' === $source[$key] || null === $source[$key]) {
            return '';
        }

        if (! is_string($source[$key])) {
            throw new InvalidArgumentException(__('Schedule values must be strings.', 'legacy-popups'));
        }

        return sanitize_text_field($source[$key]);
    }

    private function assert_builder_schema(array $builder_schema): void
    {
        if (isset($builder_schema['version']) && ! is_numeric($builder_schema['version'])) {
            throw new InvalidArgumentException(__('Builder schema version must be numeric.', 'legacy-popups'));
        }

        if (! isset($builder_schema['layout']) || ! is_array($builder_schema['layout'])) {
            throw new InvalidArgumentException(__('Builder schema layout is required.', 'legacy-popups'));
        }

        if (! isset($builder_schema['nodes']) || ! is_array($builder_schema['nodes'])) {
            throw new InvalidArgumentException(__('Builder schema nodes are required.', 'legacy-popups'));
        }

        foreach ($builder_schema['nodes'] as $node) {
            if (! is_array($node)) {
                throw new InvalidArgumentException(__('Each builder node must be an object.', 'legacy-popups'));
            }

            if (! isset($node['type']) || ! is_string($node['type']) || '' === trim($node['type'])) {
                throw new InvalidArgumentException(__('Each builder node needs a type.', 'legacy-popups'));
            }

            if (isset($node['id']) && ! is_string($node['id'])) {
                throw new InvalidArgumentException(__('Builder node IDs must be strings.', 'legacy-popups'));
            }

            if (! isset($node['props']) || ! is_array($node['props'])) {
                throw new InvalidArgumentException(__('Each builder node needs a props object.', 'legacy-popups'));
            }
        }
    }

    private function assert_group_schema(array $schema, string $message): void
    {
        if (! array_key_exists('groups', $schema) || ! is_array($schema['groups'])) {
            throw new InvalidArgumentException($message);
        }
    }

    private function assert_display_schema(array $display_schema): void
    {
        if (! array_key_exists('position', $display_schema) || ! is_string($display_schema['position'])) {
            throw new InvalidArgumentException(__('Display schema position is required.', 'legacy-popups'));
        }

        if (! array_key_exists('overlay', $display_schema) || ! is_bool($display_schema['overlay'])) {
            throw new InvalidArgumentException(__('Display schema overlay must be a boolean.', 'legacy-popups'));
        }

        if (! array_key_exists('animation', $display_schema) || ! is_string($display_schema['animation'])) {
            throw new InvalidArgumentException(__('Display schema animation is required.', 'legacy-popups'));
        }
    }

    private function assert_frequency_schema(array $frequency_schema): void
    {
        $required_keys = array('storage', 'impression', 'close', 'conversion');

        foreach ($required_keys as $key) {
            if (! array_key_exists($key, $frequency_schema) || ! is_array($frequency_schema[$key])) {
                throw new InvalidArgumentException(__('Frequency schema is incomplete.', 'legacy-popups'));
            }
        }
    }
}