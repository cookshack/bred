import * as Mounts from './main-code-mounts.mjs'

// A provider connection that cannot get response headers is not a slow turn:
// no output can be produced until the request starts. Keep this short so a
// network switch does not leave the first request waiting for the provider's
// five minute default. The per-chunk timeout stays at the provider default.
export
function providers
() {
  return { goat: { settings: { headerTimeout: 60000 } },
           openrouter: { settings: { headerTimeout: 60000 } },
           deepinfra: { settings: { headerTimeout: 60000 } } }
}

export
function build
(mounts, workingDir) {
  return { websearch: { provider: 'exa' },
           references: Mounts.references(mounts, workingDir),
           permission: { external_directory: 'allow',
                         websearch: 'allow',
                         read: { [Mounts.containerAuthPath()]: 'deny' },
                         bash: { 'docker *': 'deny',
                                 'podman *': 'deny',
                                 'docker-compose *': 'deny',
                                 'nerdctl *': 'deny' } },
           providers: providers() }
}
