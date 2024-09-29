export default
function (results) {
  let str

  str = ''
  results.forEach(result => {
    result.messages.forEach(m => {
      str += (result.filePath + ':' + m.line + ':' + m.column + ': ' + m.message + ' (' + m.messageId + ', ' + m.ruleId + ')\n')
      //str += 'test' //result.filePath + '\n'
      //str += '\n'
    })
  })
  return str
  //return 'test'
  //return JSON.stringify(results, null, 2)
}
