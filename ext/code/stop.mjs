// Abort an agent run the way the rest of bred does (the sdk returns
// { data, error } rather than throwing, so failures must be checked).

export
async function cancel
(client, sessionID, directory) {
  let res

  if (sessionID == null)
    throw new Error('missing sessionID')
  res = await client.session.abort({ sessionID, directory })
  if (res?.error)
    throw new Error(res.error.message || JSON.stringify(res.error))
}
