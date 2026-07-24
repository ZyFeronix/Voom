import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/**
 * ESLint flat config for VSocial (SvelteKit 5, runes mode).
 *
 * Notas:
 * - El parser de Svelte (svelte-eslint-parser) se aplica a `*.svelte`.
 * - Los módulos de runes (`*.svelte.js`, p.ej. lib/stores/*.svelte.js) son JS
 *   plano pero usan las macros del compilador de Svelte 5 ($state, $derived,
 *   $props, $effect, $bindable). Se declaran como globals para evitar no-undef.
 * - El proyecto usa prettier con prettier-plugin-svelte; se desactivan las
 *   reglas de formato de eslint-plugin-svelte que chocarían con prettier.
 */
const RUNE_GLOBALS = {
	$state: 'readonly',
	$derived: 'readonly',
	$props: 'readonly',
	$effect: 'readonly',
	$bindable: 'readonly',
	$host: 'readonly',
	$inspect: 'readonly'
};

/** @type {import('eslint').Linter.Config[]} */
export default [
	{
		ignores: ['build/', '.svelte-kit/', 'node_modules/', '.qoder/', '_auth_migration_backup/']
	},
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		rules: {
			// Convenciones del proyecto:
			// - Parámetros/vars que empiecen por '_' son intencionalmente no usados
			//   (p.ej. catch (_) {}, params de handler de SvelteKit no consumidos).
			// - ignoreRestSiblings: permite desestructurar { request, url, params }
			//   y dejar algunos sin usar.
			'no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			],
			// Los catch vacíos son intencionales (errores ignorados) y abundan en
			// el códigobase; se permite un bloque catch sin cuerpo.
			'no-empty': ['error', { allowEmptyCatch: true }],
			// El saneamiento HTML se hace en el servidor con DOMPurify
			// (lib/server/entities.js), por lo que {@html} aquí es seguro.
			'svelte/no-at-html-tags': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: import('svelte-eslint-parser')
			}
		}
	},
	{
		// Módulos de runes de Svelte 5: JS plano con macros globales del compilador.
		files: ['**/*.svelte.js'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: RUNE_GLOBALS
		}
	}
];
