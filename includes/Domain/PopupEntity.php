<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

final class PopupEntity
{
    private ?int $id;

    private string $title;

    private string $post_status;

    private string $popup_status;

    private array $builder_schema;

    private array $trigger_schema;

    private array $targeting_schema;

    private array $display_schema;

    private array $frequency_schema;

    private string $schedule_from;

    private string $schedule_to;

    public function __construct(
        ?int $id = null,
        string $title = '',
        string $post_status = 'draft',
        string $popup_status = PopupStatus::DRAFT,
        array $builder_schema = array(),
        array $trigger_schema = array(),
        array $targeting_schema = array(),
        array $display_schema = array(),
        array $frequency_schema = array(),
        string $schedule_from = '',
        string $schedule_to = ''
    ) {
        $this->id               = null !== $id ? absint($id) : null;
        $this->title            = PopupValueSanitizer::sanitize_text($title);
        $this->post_status      = sanitize_key($post_status);
        $this->popup_status     = PopupValueSanitizer::sanitize_popup_status($popup_status);
        $this->builder_schema   = BuilderSchema::sanitize_and_migrate($builder_schema);
        $this->trigger_schema   = PopupValueSanitizer::sanitize_trigger_schema($trigger_schema);
        $this->targeting_schema = PopupValueSanitizer::sanitize_targeting_schema($targeting_schema);
        $this->display_schema   = PopupValueSanitizer::sanitize_display_schema($display_schema);
        $this->frequency_schema = PopupValueSanitizer::sanitize_frequency_schema($frequency_schema);
        $this->schedule_from    = PopupValueSanitizer::sanitize_nullable_text($schedule_from);
        $this->schedule_to      = PopupValueSanitizer::sanitize_nullable_text($schedule_to);
    }

    public static function from_array(array $data): self
    {
        return new self(
            isset($data['id']) ? (int) $data['id'] : null,
            isset($data['title']) ? (string) $data['title'] : '',
            isset($data['post_status']) ? (string) $data['post_status'] : 'draft',
            isset($data['popup_status']) ? (string) $data['popup_status'] : PopupStatus::DRAFT,
            isset($data['builder_schema']) && is_array($data['builder_schema']) ? $data['builder_schema'] : array(),
            isset($data['trigger_schema']) && is_array($data['trigger_schema']) ? $data['trigger_schema'] : array(),
            isset($data['targeting_schema']) && is_array($data['targeting_schema']) ? $data['targeting_schema'] : array(),
            isset($data['display_schema']) && is_array($data['display_schema']) ? $data['display_schema'] : array(),
            isset($data['frequency_schema']) && is_array($data['frequency_schema']) ? $data['frequency_schema'] : array(),
            isset($data['schedule_from']) ? (string) $data['schedule_from'] : '',
            isset($data['schedule_to']) ? (string) $data['schedule_to'] : ''
        );
    }

    public function id(): ?int
    {
        return $this->id;
    }

    public function title(): string
    {
        return $this->title;
    }

    public function post_status(): string
    {
        return '' !== $this->post_status ? $this->post_status : 'draft';
    }

    public function popup_status(): string
    {
        return $this->popup_status;
    }

    public function builder_schema(): array
    {
        return $this->builder_schema;
    }

    public function trigger_schema(): array
    {
        return $this->trigger_schema;
    }

    public function targeting_schema(): array
    {
        return $this->targeting_schema;
    }

    public function display_schema(): array
    {
        return $this->display_schema;
    }

    public function frequency_schema(): array
    {
        return $this->frequency_schema;
    }

    public function schedule_from(): string
    {
        return $this->schedule_from;
    }

    public function schedule_to(): string
    {
        return $this->schedule_to;
    }

    public function with_id(int $id): self
    {
        $data       = $this->to_array();
        $data['id'] = absint($id);

        return self::from_array($data);
    }

    public function with_popup_status(string $popup_status): self
    {
        $data                 = $this->to_array();
        $data['popup_status'] = PopupStatus::sanitize($popup_status);
        $data['post_status']  = PopupStatus::to_post_status($data['popup_status']);

        return self::from_array($data);
    }

    public function to_array(): array
    {
        return array(
            'id'               => $this->id,
            'title'            => $this->title,
            'post_status'      => $this->post_status(),
            'popup_status'     => $this->popup_status,
            'builder_schema'   => $this->builder_schema,
            'trigger_schema'   => $this->trigger_schema,
            'targeting_schema' => $this->targeting_schema,
            'display_schema'   => $this->display_schema,
            'frequency_schema' => $this->frequency_schema,
            'schedule_from'    => $this->schedule_from,
            'schedule_to'      => $this->schedule_to,
        );
    }
}