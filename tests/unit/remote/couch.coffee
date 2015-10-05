async   = require 'async'
child   = require 'child_process'
request = require 'request-json-light'
should  = require 'should'

Couch = require '../../../backend/remote/couch'


PORT = 5895

describe "DB Tests", ->

    before (done) ->
        client = request.newClient "http://localhost:#{PORT}"
        async.waterfall [
            # Start the server
            (next) ->
                # TODO use tmp as the current working directory
                bin = "node_modules/.bin/pouchdb-server"
                args = ["-m", "-p", "#{PORT}"]
                @server = child.spawn bin, args
                setTimeout next, 1000

            # Create a user
            (next) ->
                options =
                    _id: "org.couchdb.user:cozy"
                    name: "cozy"
                    type: "user"
                    roles: []
                    password: "cozytest"
                client.put "_users/cozy", options, (err) -> next err

            # Create a database
            (next) ->
                console.log next
                options =
                    id: "cozy"
                    name: "cozy"
                client.put "cozy", options, (err) -> next err

            # Add the user to the database admins
            (next) ->
                options =
                    admins:
                        names: ["cozy"]
                        roles: []
                    users:
                        names: []
                        roles: []
                client.put "cozy/_security", options, (err) -> next err
        ], done

    before ->
        @couch = new Couch
            url: "http://localhost:#{PORT}"
            user: "cozy"
            password: "cozytest"

    after ->
        @server.kill()

    it 'getLastRemoteChangeSeq', (done) ->
        @couch.getLastRemoteChangeSeq (err, seq) ->
            should.not.exist err
            seq.should.equal 0
            done()

    it 'copyViewFromRemote'
    it 'replicateToRemote'
    it 'uploadBinary'
    it 'getRemoteDoc'
    it 'createEmptyRemoteDoc'
    it 'uploadAsAttachment'
