import * as EslintConfig from './lib/@cookshack/eslint-config.js'

export
default [ { ignores: [ 'TAGS.mjs', 'json.mjs' ] },
          { files: [ '*.js', '*.mjs', 'ext/*/*.mjs' ],
            languageOptions: EslintConfig.languageOptions,
            plugins: EslintConfig.plugins,
            rules: EslintConfig.rules } ]
