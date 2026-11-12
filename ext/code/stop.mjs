// Interrupt an agent run the way the rest of bred does (the v2 client rejects
// on failure rather than returning { data, error }).

export
async function cancel
(client, sessionID, options) {
  if (sessionID == null)
    throw new Error('missing sessionID')
  return await client.session.interrupt({ sessionID }, options)
}
