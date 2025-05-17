console.log('*** preload-web ***')

globalThis.document.addEventListener('click', () => {
  console.log('cl')
})

globalThis.document.addEventListener('mousedown', () => {
  console.log('md')
})

process.once('document-start', () => {
  console.log('THIS IS THE DOCUMENT START')
})
