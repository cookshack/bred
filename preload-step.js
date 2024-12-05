//import * as Bred from './bred.mjs'

console.log('*** preload-step ***')

globalThis.document.addEventListener('click', () => {
  console.log('STEP cl')
})

globalThis.document.addEventListener('mousedown', () => {
  console.log('STEP md')
})

process.once('document-start', () => {
  console.log('STEP: THIS IS THE DOCUMENT START')
})
