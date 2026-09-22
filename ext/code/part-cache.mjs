// Cache element lookups per part id, so a stream of deltas doesn't re-scan the
// whole message area for each one.

export
function find
(cache, w, partID, cls, field) {
  let hit

  hit = cache.get(partID)
  if (hit == null) {
    hit = {}
    cache.set(partID, hit)
  }
  if (hit[field] && hit[field].isConnected)
    return hit[field]
  hit[field] = w.querySelector('.' + cls + '[data-partid="' + partID + '"]')
  return hit[field]
}
