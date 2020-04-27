/* @flow */

const autoBind = require('auto-bind')
const _ = require('lodash')
const path = require('path')

const conflictHelpers = require('./conflict')
const cozyHelpers = require('./cozy')

const { Remote } = require('../../../core/remote')
const { jsonApiToRemoteDoc } = require('../../../core/remote/document')
const { TRASH_DIR_NAME } = require('../../../core/remote/constants')

/*::
import type cozy from 'cozy-client-js'
import type { Pouch } from '../../../core/pouch'
import type { RemoteOptions } from '../../../core/remote'
import type { RemoteDoc } from '../../../core/remote/document'
*/

class RemoteTestHelpers {
  /*::
  side: Remote
  */

  constructor(opts /*: RemoteOptions */) {
    this.side = new Remote(opts)
    this.side.remoteCozy.client = cozyHelpers.cozy
    autoBind(this)
  }

  get cozy() /*: cozy.Client */ {
    return this.side.remoteCozy.client
  }
  get pouch() /*: Pouch */ {
    return this.side.pouch
  }

  async ignorePreviousChanges() {
    const { last_seq } = await this.side.remoteCozy.changes()
    await this.pouch.setRemoteSeqAsync(last_seq)
  }

  async pullChanges() {
    await this.side.watcher.watch()
  }

  async createTree(
    paths /*: Array<string> */
  ) /*: Promise<{ [string]: RemoteDoc}> */ {
    const remoteDocsByPath = {}
    for (const p of paths) {
      const name = path.posix.basename(p)
      const parentPath = path.posix.dirname(p)
      const dirID = (
        remoteDocsByPath[parentPath + '/'] ||
        (await this.cozy.files
          .statByPath('/' + parentPath + '/')
          .then(this.side.remoteCozy.toRemoteDoc)) ||
        {}
      )._id
      if (p.endsWith('/')) {
        remoteDocsByPath[p] = await this.cozy.files
          .createDirectory({
            name,
            dirID,
            lastModifiedDate: new Date()
          })
          .then(this.side.remoteCozy.toRemoteDoc)
      } else {
        remoteDocsByPath[p] = await this.cozy.files
          .create(`Content of file ${p}`, {
            name,
            dirID,
            lastModifiedDate: new Date()
          })
          .then(this.side.remoteCozy.toRemoteDoc)
      }
    }

    return remoteDocsByPath
  }

  // TODO: Extract reusable #scan() method from tree*()

  async tree(
    opts /*: {ellipsize: boolean} */ = { ellipsize: true }
  ) /*: Promise<string[]> */ {
    const pathsToScan = ['/', `/${TRASH_DIR_NAME}`]
    const relPaths = [`${TRASH_DIR_NAME}/`]

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const dirPath = pathsToScan.shift()
      if (dirPath == null) break

      let dir
      try {
        dir = await this.cozy.files.statByPath(dirPath)
      } catch (err) {
        if (err.status !== 404) throw err
        dir = {
          // $FlowFixMe
          relations: () => [
            { attributes: { name: '<BROKEN>', type: '<BROKEN>' } }
          ]
        }
      }
      for (const content of dir.relations('contents')) {
        const { name, type } = content.attributes
        const remotePath = path.posix.join(dirPath, name)
        let relPath = remotePath.slice(1)

        if (type === 'directory') {
          relPath += '/'
          pathsToScan.push(remotePath)
        }

        relPaths.push(relPath)
      }
    }

    const ellipsizeDate = opts.ellipsize
      ? conflictHelpers.ellipsizeDate
      : _.identity
    return relPaths
      .sort()
      .map(ellipsizeDate)
      .map(p => p.replace(/\(__cozy__: \d+\)/, '(__cozy__: ...)'))
  }

  async treeWithoutTrash(
    opts /*: {ellipsize: boolean} */ = { ellipsize: true }
  ) /*: Promise<string[]> */ {
    return (await this.tree(opts)).filter(
      p => !p.startsWith(`${TRASH_DIR_NAME}/`)
    )
  }

  async trash() {
    const TRASH_REGEXP = new RegExp(`^${TRASH_DIR_NAME}/(.+)$`)
    return _.chain(await this.tree())
      .map(p => _.nth(p.match(TRASH_REGEXP), 1))
      .compact()
      .map(p => p.replace(/\(__cozy__: \d+\)/, '(__cozy__: ...)'))
      .value()
  }

  async simulateChanges(docs /*: * */) {
    await this.side.watcher.pullMany(docs)
  }

  async readFile(path /*: string */) {
    if (!path.startsWith('/')) path = '/' + path
    const resp = await this.cozy.files.downloadByPath(path)
    return resp.text()
  }

  async byIdMaybe(id /*: string */) {
    try {
      return jsonApiToRemoteDoc(await this.cozy.files.statById(id))
    } catch (err) {
      return null
    }
  }
}

module.exports = {
  RemoteTestHelpers
}
