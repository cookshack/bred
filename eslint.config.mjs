import * as EslintConfig from './lib/@cookshack/eslint-config.js'

export
default [ { ignore: [ 'TAGS.mjs', 'js/json.mjs' ] },
          { files: [ '*.js', '*.mjs', 'js/*.js', 'js/*.mjs', 'ext/*/*.mjs' ],
            languageOptions: EslintConfig.languageOptions,
            plugins: EslintConfig.plugins,
            rules: EslintConfig.rules },
          { files: [ 'js/json.mjs' ],
            rules: { '*': 'off' } } ]
