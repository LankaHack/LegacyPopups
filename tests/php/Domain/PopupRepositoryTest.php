<?php

declare(strict_types=1);

namespace LegacyPopups\Tests\Domain;

use LegacyPopups\Domain\PopupEntity;
use LegacyPopups\Domain\PopupMeta;
use LegacyPopups\Domain\PopupRepository;
use LegacyPopups\Domain\PopupStatus;
use PHPUnit\Framework\TestCase;

final class PopupRepositoryTest extends TestCase
{
    private PopupRepository $repository;

    protected function setUp(): void
    {
        legacypopups_test_reset_wp_state();
        $this->repository = new PopupRepository();
    }

    public function testCreatePersistsPopupAndMeta(): void
    {
        $created = $this->repository->create($this->makePopup(array(
            'title' => 'Spring Offer',
            'popup_status' => PopupStatus::ACTIVE,
        )));

        self::assertNotNull($created->id());
        self::assertSame('Spring Offer', $created->title());
        self::assertSame(PopupStatus::ACTIVE, $created->popup_status());
        self::assertSame(PopupStatus::ACTIVE, get_post_meta((int) $created->id(), PopupMeta::POPUP_STATUS, true));
        self::assertIsArray(get_post_meta((int) $created->id(), PopupMeta::BUILDER_SCHEMA, true));
    }

    public function testQueryCanFilterByPopupStatus(): void
    {
        $active = $this->repository->create($this->makePopup(array(
            'title' => 'Active Popup',
            'popup_status' => PopupStatus::ACTIVE,
        )));
        $this->repository->create($this->makePopup(array(
            'title' => 'Draft Popup',
            'popup_status' => PopupStatus::DRAFT,
        )));

        $result = $this->repository->query(array('popup_status' => PopupStatus::ACTIVE));

        self::assertCount(1, $result['items']);
        self::assertSame($active->id(), $result['items'][0]->id());
    }

    public function testDuplicateCreatesNewDraftCopy(): void
    {
        $original = $this->repository->create($this->makePopup(array(
            'title' => 'Original Campaign',
            'popup_status' => PopupStatus::ACTIVE,
        )));

        $duplicate = $this->repository->duplicate((int) $original->id());

        self::assertNotNull($duplicate);
        self::assertNotSame($original->id(), $duplicate->id());
        self::assertSame('Original Campaign (Copy)', $duplicate->title());
        self::assertSame(PopupStatus::DRAFT, $duplicate->popup_status());
        self::assertSame('draft', $duplicate->post_status());
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
            'trigger_schema' => array('groups' => array()),
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