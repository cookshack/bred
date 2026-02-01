import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

import * as CMCollab from '../lib/@codemirror/collab.js'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { v4 as uuidv4 } from '../lib/uuid/index.js'

async function pushUpdates
(id, version, updates, cb) {
  updates = updates?.map(u => ({ clientID: u.clientID,
                                 changes: u.changes.toJSON() }))
  await Tron.acmd('peer.push', [ id, version, updates ])
  cb()
}

export
function make
(id, startVersion) {
  let plugin

  plugin = CMView.ViewPlugin.fromClass(class {
    constructor
    (view) {
      let version

      this.view = view
      version = CMCollab.getSyncedVersion(this.view.state)
      this.ch = 'peer.pull/' + uuidv4()
      this.chOff = Tron.on(this.ch, this.pull.bind(this))
      Tron.cmd('peer.pull', [ id, version, this.ch ], err => {
        if (err) {
          d('peer.pull: ' + err.message)
          return
        }
      })
    }

    update
    (update) {
      if (update.docChanged)
        this.push()
    }

    push
    () {
      let updates, version

      updates = CMCollab.sendableUpdates(this.view.state)
      if (this.pushing || (updates.length == 0))
        return
      if (1) {
        d('UPDATES')
        updates.forEach((u,i) => {
          d(i + ': ' + u.changes?.toJSON())
        })
      }
      this.pushing = true
      version = CMCollab.getSyncedVersion(this.view.state)
      d('SYNCED VERSION ' + version)
      pushUpdates(id, (version ?? 0) + 1, updates, () => {
        this.pushing = false
        // Regardless of whether the push failed or new updates came in
        // while it was running, try again if there are updates remaining
        if (CMCollab.sendableUpdates(this.view.state).length)
          setTimeout(() => this.push(), 100)
      })
    }

    pull
    (err, data) {
      let updates, tr

      //d('PULL ' + this.ch)

      if (err) {
        d('makePeer pull: ' + err.message)
        return
      }

      if (this.done)
        return

      updates = data.updates.map(u => ({ changes: CMState.ChangeSet.fromJSON(u.changes),
                                         clientID: u.clientID }))
      if (1) {
        d('RECEIVE')
        updates.forEach((u,i) => {
          d(i + ': ' + u.changes?.toJSON())
        })
      }
      tr = CMCollab.receiveUpdates(this.view.state, updates)
      this.view.dispatch(tr)
    }

    destroy() {
      this.done = true
      this.chOff && this.chOff()
    }
  })

  return [ CMCollab.collab({ startVersion }), plugin ]
}
