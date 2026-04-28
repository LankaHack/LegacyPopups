<?php

declare(strict_types=1);

namespace LegacyPopups\Tests\Frontend;

use LegacyPopups\Domain\PopupEntity;
use LegacyPopups\Frontend\PopupResolver;
use LegacyPopups\Frontend\RequestContext;
use PHPUnit\Framework\TestCase;

final class PopupResolverTest extends TestCase
{
    private PopupResolver $resolver;

    protected function setUp(): void
    {
        $this->resolver = new PopupResolver();
    }

    public function testResolveReturnsPopupWithoutTargetingRules(): void
    {
        $context = $this->makeContext();
        $popup = PopupEntity::from_array(array(
            'title' => 'Generic Popup',
            'targeting_schema' => array('groups' => array()),
        ));

        $resolved = $this->resolver->resolve(array($popup), $context);

        self::assertCount(1, $resolved);
    }

    public function testResolveMatchesPopupWhenAllRulesInGroupMatch(): void
    {
        $context = $this->makeContext();
        $popup = PopupEntity::from_array(array(
            'title' => 'Sale Popup',
            'targeting_schema' => array(
                'groups' => array(
                    array(
                        'rules' => array(
                            array('type' => 'device', 'value' => array('desktop')),
                            array('type' => 'url', 'value' => array('/sale*')),
                            array('type' => 'locale', 'value' => array('de_de')),
                        ),
                    ),
                ),
            ),
        ));

        $resolved = $this->resolver->resolve(array($popup), $context);

        self::assertCount(1, $resolved);
        self::assertSame('Sale Popup', $resolved[0]->title());
    }

    public function testResolveRejectsPopupWhenGroupDoesNotMatch(): void
    {
        $context = $this->makeContext();
        $popup = PopupEntity::from_array(array(
            'title' => 'Members Only',
            'targeting_schema' => array(
                'groups' => array(
                    array(
                        'rules' => array(
                            array('type' => 'login_status', 'value' => 'logged_in'),
                            array('type' => 'weekday', 'value' => array('sun')),
                        ),
                    ),
                ),
            ),
        ));

        $resolved = $this->resolver->resolve(array($popup), $context);

        self::assertSame(array(), $resolved);
    }

    private function makeContext(): RequestContext
    {
        return new RequestContext(
            'https://example.test/sale',
            '/sale',
            'de_DE',
            'de',
            'desktop',
            false,
            '13:30',
            2,
            'tue'
        );
    }
}