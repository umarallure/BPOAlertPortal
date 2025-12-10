// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Keep Vue behaviour rules we care about, but relax stylistic ones
    'vue/no-multiple-template-root': 'off',

    // Turn off noisy Vue template formatting rules
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    'vue/html-closing-bracket-newline': 'off',
    'vue/html-indent': 'off',

    // Turn off generic stylistic rules
    'no-trailing-spaces': 'off',
    'indent': 'off',
    'quote-props': 'off',

    '@typescript-eslint/no-explicit-any': 'off'
  }
})
