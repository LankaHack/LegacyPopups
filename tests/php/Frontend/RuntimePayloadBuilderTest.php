<?php

declare(strict_types=1);

namespace LegacyPopups\Tests\Frontend;

use LegacyPopups\Domain\PopupEntity;
use LegacyPopups\Frontend\RuntimePayloadBuilder;
use PHPUnit\Framework\TestCase;

final class RuntimePayloadBuilderTest extends TestCase
{
    public function testBuildPreservesTrackConversionForButtonNodes(): void
    {
        $builder = new RuntimePayloadBuilder();
        $popup = PopupEntity::from_array(array(
            'title' => 'CTA Popup',
            'builder_schema' => array(
                'version' => 1,
                'layout' => array(),
                'nodes' => array(
                    array(
                        'id' => 'cta',
                        'type' => 'button',
                        'props' => array(
                            'label' => 'Buy now',
                            'url' => '/checkout',
                            'trackConversion' => true,
                        ),
                    ),
                ),
            ),
        ));

        $payload = $builder->build($popup);

        self::assertTrue($payload['nodes'][0]['props']['trackConversion']);
    }
}