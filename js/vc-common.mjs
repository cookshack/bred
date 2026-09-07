export
function stateClr
(state) {
  if (state == 'M')
    return '--clr-syntax3'
  if (state == 'A')
    return '--clr-syntax0'
  if (state == 'R')
    return '--clr-emph'
  if (state == 'P')
    return '--clr-syntax4'
  if (state == 'D')
    return '--clr-text'
  if (state == 'O')
    return '--clr-syntax1'
  if (state == 'C')
    return '--clr-nb2'
  return '--clr-text'
}

export
function formatDate
(str) {
  if (str?.length) {
    let date, now, days

    days = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ]
    date = new Date(str)
    now = new Date()

    if (((date.getFullYear() == now.getFullYear())
         && (date.getMonth() == now.getMonth())
         && (date.getDate() == now.getDate()))
        || ((now - date) < (24 * 60 * 60 * 1000))) {
      let time

      time = String(date.getHours()).padStart(2, '0')
        + 'h' + String(date.getMinutes()).padStart(2, '0')
      return time.padEnd(20)
    }

    return days[date.getDay()] + ' '
      + date.getFullYear()
      + '-' + String(date.getMonth() + 1).padStart(2, '0')
      + '-' + String(date.getDate()).padStart(2, '0')
      + ' ' + String(date.getHours()).padStart(2, '0')
      + 'h' + String(date.getMinutes()).padStart(2, '0')
  }

  return ''
}

export
function shortReason
(reason) {
  if (reason == 'review_requested')
    return 'review'
  if (reason == 'subscribed')
    return 'sub'
  return reason
}
