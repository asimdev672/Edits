<?php

namespace Botble\Shortcode;

use Botble\Shortcode\Compilers\ShortcodeCompiler;

class Shortcode
{
    /**
     * Shortcode compiler
     *
     * @var ShortcodeCompiler
     */
    protected $compiler;

    /**
     * Constructor
     *
     * @param ShortcodeCompiler $compiler
     * @since 2.1
     */
    public function __construct(ShortcodeCompiler $compiler)
    {
        $this->compiler = $compiler;
    }

    /**
     * Register a new shortcode
     *
     * @param string $key
     * @param string|null $name
     * @param string|null $description
     * @param null $callback
     * @return Shortcode
     * @since 2.1
     */
    public function register(string $key, ?string $name, ?string $description = null, $callback = null): Shortcode
    {
        $this->compiler->add($key, $name, $description, $callback);

        return $this;
    }

    /**
     * Enable the shortcode
     *
     * @return Shortcode
     * @since 2.1
     */
    public function enable(): Shortcode
    {
        $this->compiler->enable();

        return $this;
    }

    /**
     * Disable the shortcode
     *
     * @return Shortcode
     * @since 2.1
     */
    public function disable(): Shortcode
    {
        $this->compiler->disable();

        return $this;
    }

    /**
     * Compile the given string
     *
     * @param string $value
     * @return string
     * @since 2.1
     */
    public function compile(string $value): string
    {
        // Always enable when we call the compile method directly
        $this->enable();

        // return compiled contents
        $html = $this->compiler->compile($value);

        $this->disable();

        return $html;
    }

    /**
     * @param string|null $value
     * @return string|null
     * @since 2.1
     */
    public function strip(?string $value): ?string
    {
        return $this->compiler->strip($value);
    }

    /**
     * @return array
     */
    public function getAll(): array
    {
        return $this->compiler->getRegistered();
    }

    /**
     * @param string $key
     * @param string|callable $html
     */
    public function setAdminConfig(string $key, $html)
    {
        $this->compiler->setAdminConfig($key, $html);
    }

    /**
     * @param string $name
     * @param array $attributes
     * @return string
     */
    public function generateShortcode(string $name, array $attributes = []): string
    {
        $parsedAttributes = '';
        foreach ($attributes as $key => $attribute) {
            $parsedAttributes .= ' ' . $key . '="' . $attribute . '"';
        }

        return '[' . $name . $parsedAttributes . '][/' . $name . ']';
    }

    /**
     * @return ShortcodeCompiler
     */
    public function getCompiler(): ShortcodeCompiler
    {
        return $this->compiler;
    }
}
