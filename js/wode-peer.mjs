import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

import * as CMCollab from '../lib/@codemirror/collab.js'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { v4 as uuidv4 } from '../lib/uuid/index.js'

async function pushUpdates
(id, version, updates) {
  updates = updates?.map(u => ({ clientID: u.clientID,
                                 changes: u.changes.toJSON() }))
  return await Tron.acmd('peer.push', [ id, version, updates ])
}

export
function make
(id, startVersion) {
  let plugin

  plugin = CMView.ViewPlugin.fromClass(class {
    constructor
    (view) {
      this.view = view
      this.ch = 'peer.pull/' + uuidv4()
      this.chOff = Tron.on(this.ch, this.pull.bind(this))
      this.pullUpdates()
    }

    update
    (update) {
      if (update.docChanged)
        this.push()
    }

    pullUpdates
    () {
      let version

      version = CMCollab.getSyncedVersion(this.view.state)
      Tron.cmd('peer.pull', [ id, version, this.ch ], err => {
                                                        if (err)
                                                          d('peer.pull: ' + err.message)
                                                      })
    }

    // Apply a batch from main only when it starts at our synced version.
    // A batch from an older version is stale, and one from a newer version
    // means we missed something, so pull the missing range instead.
    applyUpdates
    (data) {
      let synced

      synced = CMCollab.getSyncedVersion(this.view.state)
      if (data.version == synced) {
        let updates

        updates = data.updates?.map(u => ({ changes: CMState.ChangeSet.fromJSON(u.changes),
                                            clientID: u.clientID }))
        if (updates?.length) {
          let tr

          tr = CMCollab.receiveUpdates(this.view.state, updates)
          this.view.dispatch(tr)
        }
        return 1
      }
      if (data.version > synced)
        this.pullUpdates()
      return 0
    }

    scheduleRetry
    () {
      if (this.done || this.retry)
        return
      this.retry = setTimeout(() => {
                                this.retry = 0
                                this.push()
                              },
                              100)
    }

    async push
    () {
      let updates, version, data

      if (this.done || this.pushing)
        return
      updates = CMCollab.sendableUpdates(this.view.state)
      if (updates.length == 0)
        return
      if (this.retry) {
        clearTimeout(this.retry)
        this.retry = 0
      }
      this.pushing = 1
      version = CMCollab.getSyncedVersion(this.view.state) + 1
      try {
        data = await pushUpdates(id, version, updates)
      }
      catch (err) {
        d('peer.push: ' + err.message)
      }
      finally {
        this.pushing = 0
      }
      if (this.done)
        return
      if (data?.resync)
        this.pullUpdates()
      else if (data)
        this.applyUpdates(data)
      if (CMCollab.sendableUpdates(this.view.state).length)
        this.scheduleRetry()
    }

    pull
    (err, data) {
      if (err) {
        d('makePeer pull: ' + err.message)
        return
      }
      if (this.done)
        return
      this.applyUpdates(data)
      if (CMCollab.sendableUpdates(this.view.state).length)
        this.scheduleRetry()
    }

    destroy
    () {
      if (this.done)
        return
      this.done = 1
      if (this.retry)
        clearTimeout(this.retry)
      this.chOff && this.chOff()
      Tron.acmd('peer.unpull', [ id, this.ch ]).catch(err => d('peer.unpull: ' + err.message))
    }
  })

  return [ CMCollab.collab({ startVersion }), plugin ]
}
