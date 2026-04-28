<?php

declare(strict_types=1);

namespace LegacyPopups\Tests\Domain;

use LegacyPopups\Domain\BuilderSchema;
use LegacyPopups\Domain\PopupEntity;
use PHPUnit\Framework\TestCase;

final class SchemaHardeningTest extends TestCase
{
    protected function setUp(): void
    {
        legacypopups_test_reset_wp_state();
    }

    public function testBuilderSchemaLimitsNodeCount(): void
    {
        $nodes = array();

        for ($index = 0; $index < 60; $index++) {
            $nodes[] = array(
                'id' => 'node-' . $index,
                'type' => 'text',
                'props' => array(
                    'content' => 'Node ' . $index,
                ),
            );
        }

        $schema = BuilderSchema::sanitize_and_migrate(array(
            'version' => 1,
            'layout' => array(),
            'nodes' => $nodes,
        ));

        self::assertCount(50, $schema['nodes']);
    }

    public function testBuilderSchemaDropsUnsupportedNodes(): void
    {
        $schema = BuilderSchema::sanitize_and_migrate(array(
            'version' => 1,
            'layout' => array(),
            'nodes' => array(
                array(
                    'id' => 'raw-html',
                    'type' => 'html',
                    'props' => array(
                        'content' => '<script>alert(1)</script>',
                    ),
                ),
            ),
        ));

        self::assertSame(array(), $schema['nodes']);
    }

    public function testPopupEntityNormalizesComplexSchemasToSafeBounds(): void
    {
        $popup = PopupEntity::from_array(array(
            'title' => 'Safe Popup',
            'builder_schema' => array(
                'version' => 1,
                'layout' => array(),
                'nodes' => array(),
            ),
            'trigger_schema' => array(
                'groups' => array(
                    array(
                        'type' => 'selector_hit',
                        'selector' => 'div:has(a):not(.a):not(.b)',
                    ),
                ),
            ),
            'targeting_schema' => array(
                'groups' => array(
                    array(
                        'rules' => array(
                            array('type' => 'url', 'value' => '/sale*,/promo*'),
                        ),
                    ),
                ),
            ),
            'display_schema' => array(
                'position' => 'sideways',
                'overlay' => 'yes',
                'animation' => 'spin',
            ),
            'frequency_schema' => array(
                'storage' => array('cookieFallback' => 'yes'),
                'impression' => array('periodDays' => 9999, 'maxCount' => 999999),
                'close' => array(),
                'conversion' => array(),
            ),
        ));

        self::assertSame('center', $popup->display_schema()['position']);
        self::assertTrue($popup->display_schema()['overlay']);
        self::assertSame('fade', $popup->display_schema()['animation']);
        self::assertSame(365, $popup->frequency_schema()['impression']['periodDays']);
        self::assertSame(1000, $popup->frequency_schema()['impression']['maxCount']);
        self::assertTrue($popup->frequency_schema()['storage']['cookieFallback']);
        self::assertArrayNotHasKey('selector', $popup->trigger_schema()['groups'][0]);
        self::assertSame(array('/sale*', '/promo*'), $popup->targeting_schema()['groups'][0]['rules'][0]['value']);
    }
}