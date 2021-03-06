/* @flow */

/*::
import type { SideName } from '../../core/side'

type FSAddDirAction = {|
  type: 'mkdir',
  path: string
|}

type FSCreateFileAction = {|
  type: 'create_file',
  path: string,
  content?: string
|}

type FSDeleteAction = {|
  type: 'delete',
  path: string
|}

type FSMoveAction = {|
  type: 'mv',
  force?: true,
  merge?: true,
  src: string,
  dst: string
|}

type FSRestoreAction = {|
  type: 'restore',
  pathInTrash: string
|}

type FSTrashAction = {|
  type: 'trash',
  path: string
|}

type FSUpdateFileAction = {|
  type: 'update_file',
  path: string,
  content: string
|}

type FSWaitAction = {|
  type: 'wait',
  ms: number
|}

type FSAction
  = FSAddDirAction
  | FSCreateFileAction
  | FSDeleteAction
  | FSMoveAction
  | FSRestoreAction
  | FSTrashAction
  | FSUpdateFileAction
  | FSWaitAction

type Explanation = string

// Path to a capture file, without extension, relative to the scenario dir.
type CaptureRelpath = string

// A scenario has multiple tests:
// - 1 local test for each Atom watcher capture
// - 1 local test for each Chokidar watcher capture
// - 1 local test for initial scan with the platform default watcher
// - 1 remote test (no capture yet)
type ScenarioTestName =
  | CaptureRelpath
  | 'stopped'
  | 'remote'

type ScenarioCompletelyDisabled = Explanation
type ScenarioTestsDisabled = {[ScenarioTestName]: Explanation}

type ScenarioTreeExpectation =
  | {
    localTree: Array<string>,
    remoteTree: Array<string>,
    }
  | { tree: Array<string>, }
type ScenarioTrashExpectation =
  | {
    localTrash: Array<string>,
    remoteTrash: Array<string>,
    }
  | { trash: Array<string>, }
type ScenarioExpectations =
  & ScenarioTreeExpectation
  & ScenarioTrashExpectation
  & { contents?: { [string]: string } }

export type ScenarioInit = Array<{|
  ino: number, path: string, content?: string, trashed?: boolean
|}>

export type Scenario = {|
  platforms?: Array<'win32'|'darwin'|'linux'>,
  side?: SideName,
  disabled?: ScenarioCompletelyDisabled | ScenarioTestsDisabled,
  useCaptures?: boolean,
  init?: ScenarioInit,
  actions: Array<FSAction>,
  expected: ScenarioExpectations,
|}
*/
