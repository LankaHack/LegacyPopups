<?php

declare(strict_types=1);

namespace LegacyPopups\Tests\Domain;

use InvalidArgumentException;
use LegacyPopups\Domain\ImportExportService;
use LegacyPopups\Domain\PopupEntity;
use LegacyPopups\Domain\PopupRepository;
use LegacyPopups\Domain\PopupStatus;
use PHPUnit\Framework\TestCase;

final class ImportExportServiceTest extends TestCase
{
    private PopupRepository $repository;
    private ImportExportService $service;

    protected function setUp(): void
    {
        legacypopups_test_reset_wp_state();
        $this->repository = new PopupRepository();
        $this->service = new ImportExportService($this->repository);
    }

    public function testExportPopupBuildsVersionedDocument(): void
    {
        $popup = $this->repository->create($this->makePopup(array(
            'title' => 'Export Me',
            'popup_status' => PopupStatus::ACTIVE,
        )));

        $document = $this->service->export_popup((int) $popup->id());

        self::assertSame(ImportExportService::DOCUMENT_FORMAT, $document['format']);
        self::assertSame(ImportExportService::DOCUMENT_VERSION, $document['version']);
        self::assertSame($popup->id(), $document['source']['popup_id']);
        self::assertSame('Export Me', $document['popup']['title']);
    }

    public function testImportPopupCreatesNewDraftPopupWithFreshId(): void
    {
        $original = $this->repository->create($this->makePopup(array(
            'title' => 'Original Popup',
            'popup_status' => PopupStatus::ACTIVE,
        )));
        $document = $this->service->export_popup((int) $original->id());

        $imported = $this->service->import_popup($document);

        self::assertNotSame($original->id(), $imported->id());
        self::assertSame('Original Popup', $imported->title());
        self::assertSame(PopupStatus::DRAFT, $imported->popup_status());
        self::assertSame('draft', $imported->post_status());
    }

    public function testImportPopupRejectsInvalidFormat(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->service->import_popup(array(
            'format' => 'broken',
            'version' => 1,
            'popup' => array(),
        ));
    }

    private function makePopup(array $overrides = array()): PopupEntity
    {
        return PopupEntity::from_array(array_merge(array(
            'title' => 'Test Popup',
            'popup_status' => PopupStatus::DRAFT,
            'builder_schema' => array(
                'version' => 1,
                'layout' => array('width' => 540, 'position' => 'center', 'overlay' => true),
                'nodes' => array(
                    array(
                        'id' => 'hero',
                        'type' => 'text',
                        'props' => array('content' => 'Hello world'),
                    ),
                ),
            ),
            'trigger_schema' => array('groups' => array(array('rules' => array(array('type' => 'page_load'))))),
            'targeting_schema' => array('groups' => array()),
            'display_schema' => array('position' => 'center', 'overlay' => true, 'animation' => 'fade'),
            'frequency_schema' => array(
                'storage' => array('session' => true, 'local' => true, 'cookieFallback' => true),
                'impression' => array('sessionOnce' => false, 'oncePerPeriod' => false, 'periodDays' => 0, 'maxCount' => 0),
                'close' => array('sessionOnce' => false, 'oncePerPeriod' => false, 'periodDays' => 0, 'maxCount' => 0),
                'conversion' => array('sessionOnce' => false, 'oncePerPeriod' => false, 'periodDays' => 0, 'maxCount' => 0),
            ),
        ), $overrides));
    }
}