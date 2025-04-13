import { ServiceManager } from '../lib/ace-linters/service-manager'

let mgr

mgr = new ServiceManager(globalThis.self)

mgr.registerService('javascript',
                    { features: { completion: false, completionResolve: false, diagnostics: true,
                                  format: false, hover: false, documentHighlight: false, signatureHelp: false },
                      module: () => import('../lib/ace-linters/javascript-service'),
                      className: 'JavascriptService',
                      modes: 'javascript' })
