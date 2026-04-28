<?php

declare(strict_types=1);

namespace LegacyPopups\Rest;

use LegacyPopups\Domain\AnalyticsService;
use LegacyPopups\Domain\ImportExportService;
use LegacyPopups\Domain\PopupRepository;

final class RestRegistrar
{
    private PopupController $popup_controller;

    private AnalyticsController $analytics_controller;

    private ImportExportController $import_export_controller;

    public function __construct(PopupRepository $popup_repository, AnalyticsService $analytics_service, ImportExportService $import_export_service)
    {
        $this->popup_controller     = new PopupController($popup_repository);
        $this->analytics_controller = new AnalyticsController($popup_repository, $analytics_service);
        $this->import_export_controller = new ImportExportController($import_export_service);
    }

    public function register_hooks(): void
    {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes(): void
    {
        $this->popup_controller->register_routes();
        $this->analytics_controller->register_routes();
        $this->import_export_controller->register_routes();
    }
}