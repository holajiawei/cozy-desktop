/* @flow */
/* eslint-env mocha */

const path = require('path')
const should = require('should')

const configHelpers = require('../support/helpers/config')
const cozyHelpers = require('../support/helpers/cozy')
const pouchHelpers = require('../support/helpers/pouch')
const TestHelpers = require('../support/helpers')

describe('Trash', () => {
  let cozy, helpers, pouch, prep

  before(configHelpers.createConfig)
  before(configHelpers.registerClient)
  beforeEach(pouchHelpers.createDatabase)
  beforeEach(cozyHelpers.deleteAll)

  afterEach(() => helpers.local.clean())
  afterEach(pouchHelpers.cleanDatabase)
  after(configHelpers.cleanConfig)

  beforeEach(async function() {
    cozy = cozyHelpers.cozy
    helpers = TestHelpers.init(this)
    pouch = helpers.pouch
    prep = helpers.prep

    await helpers.local.setupTrash()
    await helpers.remote.ignorePreviousChanges()
  })

  describe('file', () => {
    let parent, file

    beforeEach(async () => {
      parent = await cozy.files.createDirectory({ name: 'parent' })
      file = await cozy.files.create('File content...', {
        name: 'file',
        dirID: parent._id
      })
      await helpers.remote.pullChanges()
      await helpers.syncAll()
      helpers.spyPouch()
    })

    context('on the local filesystem', () => {
      it('trashes the file on the remote Cozy', async () => {
        await prep.trashFileAsync('local', { path: 'parent/file' })

        should(helpers.putDocs('path', 'deleted', 'trashed')).deepEqual([
          { path: path.normalize('parent/file'), deleted: true }
        ])
        await should(pouch.db.get(file._id)).be.rejectedWith({ status: 404 })

        await helpers.syncAll()

        should(await helpers.remote.tree()).deepEqual([
          '.cozy_trash/',
          '.cozy_trash/file',
          'parent/'
        ])
      })

      context('before the file was moved on the remote Cozy', () => {
        it('does not trash the file on the remote Cozy and re-downloads it', async () => {
          await helpers.local.syncDir.remove('parent/file')
          await helpers.local.scan()
          await cozy.files.updateAttributesById(file._id, {
            name: 'file',
            dir_id: parent.attributes.dir_id
          })
          await helpers.remote.pullChanges()
          await helpers.syncAll()

          should(await helpers.trees()).deepEqual({
            local: ['file', 'parent/'],
            remote: ['file', 'parent/']
          })
        })
      })

      // This situation can happen if the synchronization is stopped after
      // we've merged the remote file movement but before it's been applied
      // and the local deletion is done afterwards, while the client is
      // stopped.
      context('after the file was moved on the remote Cozy', () => {
        it('does not trash the file on the remote Cozy and re-downloads it', async () => {
          await cozy.files.updateAttributesById(file._id, {
            name: 'file',
            dir_id: parent.attributes.dir_id
          })
          await helpers.remote.pullChanges()
          await helpers.local.syncDir.remove('parent/file')
          await helpers.local.scan()
          await helpers.syncAll()

          should(await helpers.trees()).deepEqual({
            local: ['file', 'parent/'],
            remote: ['file', 'parent/']
          })
        })
      })
    })

    context('on the remote Cozy', () => {
      it('trashes the file on the local filesystem', async () => {
        await cozy.files.trashById(file._id)

        await helpers.remote.pullChanges()

        should(helpers.putDocs('path', 'deleted', 'trashed')).deepEqual([
          { path: path.normalize('parent/file'), deleted: true }
        ])
        await should(pouch.db.get(file._id)).be.rejectedWith({ status: 404 })

        await helpers.syncAll()

        should(await helpers.local.tree()).deepEqual(['/Trash/file', 'parent/'])
      })

      context('before the file was moved on the local filesystem', () => {
        it('does not trash the file on the local filesystem and restores it', async () => {
          await cozy.files.trashById(file._id)
          await helpers.remote.pullChanges()
          await helpers.local.syncDir.move(
            path.normalize('parent/file'),
            'file'
          )
          await helpers.local.scan()
          await helpers.syncAll()

          should(await helpers.trees()).deepEqual({
            local: ['file', 'parent/'],
            remote: ['file', 'parent/']
          })
        })
      })

      context('after the file was moved on the local filesystem', () => {
        it('does not trash the file on the local filesystem and restores it', async () => {
          await helpers.local.syncDir.move(
            path.normalize('parent/file'),
            'file'
          )
          await helpers.local.scan()
          await cozy.files.trashById(file._id)
          await helpers.remote.pullChanges()
          await helpers.syncAll()

          should(await helpers.trees()).deepEqual({
            local: ['file', 'parent/'],
            remote: ['file', 'parent/']
          })
        })
      })
    })

    context('destroyed on the remote Cozy', () => {
      context('before the file was moved on the local filesystem', () => {
        it('does not trash the file on the local filesystem and re-uploads it', async () => {
          await cozy.files.destroyById(file._id)
          await helpers.remote.pullChanges()
          await helpers.local.syncDir.move(
            path.normalize('parent/file'),
            'file'
          )
          await helpers.local.scan()
          await helpers.syncAll()

          should(await helpers.trees()).deepEqual({
            local: ['file', 'parent/'],
            remote: ['file', 'parent/']
          })
        })
      })

      context('after the file was moved on the local filesystem', () => {
        it('does not trash the file on the local filesystem and re-uploads it', async () => {
          await helpers.local.syncDir.move(
            path.normalize('parent/file'),
            'file'
          )
          await helpers.local.scan()
          await cozy.files.destroyById(file._id)
          await helpers.remote.pullChanges()
          await helpers.syncAll()

          should(await helpers.trees()).deepEqual({
            local: ['file', 'parent/'],
            remote: ['file', 'parent/']
          })
        })
      })
    })
  })

  describe('directory', () => {
    let parent, dir, subdir

    beforeEach(async () => {
      parent = await cozy.files.createDirectory({ name: 'parent' })
      dir = await cozy.files.createDirectory({ name: 'dir', dirID: parent._id })
      await cozy.files.createDirectory({ name: 'empty-subdir', dirID: dir._id })
      subdir = await cozy.files.createDirectory({
        name: 'subdir',
        dirID: dir._id
      })
      await cozy.files.create('foo', { name: 'file', dirID: subdir._id })

      await helpers.remote.pullChanges()
      await helpers.syncAll()

      helpers.spyPouch()
    })

    context('on the local filesystem', () => {
      it('trashes the directory on the remote Cozy', async () => {
        await prep.trashFolderAsync('local', {
          path: path.normalize('parent/dir')
        })

        should(helpers.putDocs('path', 'deleted', 'trashed')).deepEqual([
          // XXX: Why isn't file deleted? (it works anyway)
          { path: path.normalize('parent/dir/subdir'), deleted: true },
          { path: path.normalize('parent/dir/empty-subdir'), deleted: true },
          { path: path.normalize('parent/dir'), deleted: true }
        ])

        await helpers.syncAll()

        should(await helpers.remote.tree()).deepEqual([
          '.cozy_trash/',
          '.cozy_trash/dir/',
          '.cozy_trash/dir/empty-subdir/',
          '.cozy_trash/dir/subdir/',
          '.cozy_trash/dir/subdir/file',
          'parent/'
        ])
      })
    })

    context('on the remote Cozy', () => {
      it('trashes the directory on the local filesystem', async () => {
        await cozy.files.trashById(dir._id)

        await helpers.remote.pullChanges()
        should(helpers.putDocs('path', 'deleted', 'trashed')).deepEqual([
          // XXX: Why isn't file deleted? (it works anyway)
          { path: path.normalize('parent/dir/subdir'), deleted: true },
          { path: path.normalize('parent/dir/empty-subdir'), deleted: true },
          { path: path.normalize('parent/dir'), deleted: true },
          { path: path.normalize('parent/dir/subdir/file'), deleted: true }
        ])

        await helpers.syncAll()
        should(await helpers.local.tree()).deepEqual([
          '/Trash/dir/',
          '/Trash/dir/empty-subdir/',
          '/Trash/dir/subdir/',
          '/Trash/dir/subdir/file',
          'parent/'
        ])
      })
    })
  })
})

describe('Restore', () => {
  let cozy, helpers

  before(configHelpers.createConfig)
  before(configHelpers.registerClient)
  beforeEach(pouchHelpers.createDatabase)
  beforeEach(cozyHelpers.deleteAll)

  afterEach(() => helpers.local.clean())
  afterEach(pouchHelpers.cleanDatabase)
  after(configHelpers.cleanConfig)

  beforeEach(async function() {
    cozy = cozyHelpers.cozy
    helpers = TestHelpers.init(this)

    await helpers.local.setupTrash()
    await helpers.remote.ignorePreviousChanges()
  })

  describe('file', () => {
    let parent, file

    beforeEach(async () => {
      parent = await cozy.files.createDirectory({ name: 'parent' })
      file = await cozy.files.create('File content...', {
        name: 'file',
        dirID: parent._id
      })
      await helpers.remote.pullChanges()
      await helpers.syncAll()
      helpers.spyPouch()
    })

    context('before trash is applied on local file system', () => {
      it('does not create a conflict', async () => {
        // Fetch and merge trashing
        await cozy.files.trashById(file._id)
        await helpers.remote.pullChanges()

        await cozy.files.restoreById(file._id)
        await helpers.remote.pullChanges()
        await helpers.syncAll()

        should(await helpers.trees()).deepEqual({
          local: ['parent/', 'parent/file'],
          remote: ['parent/', 'parent/file']
        })
      })
    })
  })

  describe('folder', () => {
    let remoteDocs

    beforeEach(async () => {
      remoteDocs = await helpers.remote.createTree([
        'parent/',
        'parent/dir/',
        'parent/dir/empty-subdir/',
        'parent/dir/subdir/',
        'parent/dir/subdir/file'
      ])

      await helpers.remote.pullChanges()
      await helpers.syncAll()
    })

    context('before trash is applied on local file system', () => {
      it('does not create conflicts', async () => {
        await cozy.files.trashById(remoteDocs['parent/dir/']._id)
        await helpers.remote.pullChanges()

        await cozy.files.restoreById(remoteDocs['parent/dir/']._id)
        await helpers.remote.pullChanges()
        await helpers.syncAll()

        should(await helpers.trees()).deepEqual({
          local: [
            'parent/',
            'parent/dir/',
            'parent/dir/empty-subdir/',
            'parent/dir/subdir/',
            'parent/dir/subdir/file'
          ],
          remote: [
            'parent/',
            'parent/dir/',
            'parent/dir/empty-subdir/',
            'parent/dir/subdir/',
            'parent/dir/subdir/file'
          ]
        })
      })
    })
  })
})
