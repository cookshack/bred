// Interrupt an agent run the way the rest of bred does (the v2 client rejects
// on failure rather than returning { data, error }).

export
async function cancel
(client, sessionID) {
  if (sessionID == null)
    throw new Error('missing sessionID')
  await client.session.interrupt({ sessionID })
}
