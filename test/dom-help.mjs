import { Window } from 'happy-dom'

export
function setupDom
() {
  let keys, window

  window = new Window()

  keys = [ 'document', 'navigator', 'Element', 'HTMLElement', 'HTMLDocument',
           'Node', 'Text', 'DocumentFragment', 'Comment', 'Event', 'CustomEvent',
           'DOMRect', 'getComputedStyle', 'requestAnimationFrame',
           'cancelAnimationFrame', 'ResizeObserver', 'MutationObserver',
           'IntersectionObserver', 'getSelection', 'FileReader', 'Blob', 'URL' ]
  keys.forEach(key => {
                 try {
                   globalThis[key] = window[key]
                 }
                 catch {
                 }
               })
  globalThis.window = window
  globalThis.document = window.document
  return window
}
