#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const targetRoot = path.join(projectRoot, 'vendor', 'photopea-app')

function uniqueItems(values) {
  const output = []
  for (const value of values) {
    if (!value) continue
    if (!output.includes(value)) output.push(value)
  }
  return output
}

function directoryContainsPhotopeaBundle(root) {
  if (!root) return false
  return (
    fs.existsSync(path.join(root, 'index.html')) &&
    fs.existsSync(path.join(root, 'static', 'js', 'pp.js'))
  )
}

function resolveSourceRoot() {
  const candidates = uniqueItems([
    process.env.PHOTOPEA_APP_ROOT,
    path.join(projectRoot, '..', 'psv2'),
    path.join(projectRoot, 'psv2')
  ])
  return candidates.find(directoryContainsPhotopeaBundle) || ''
}

function shouldCopyEntry(relativePath) {
  if (!relativePath) return true
  const normalized = relativePath.split(path.sep).join('/')
  if (normalized.startsWith('.git/')) return false
  if (normalized.startsWith('node_modules/')) return false
  return true
}

function copyBundle(sourceRoot, destinationRoot) {
  fs.mkdirSync(path.dirname(destinationRoot), { recursive: true })
  fs.rmSync(destinationRoot, { recursive: true, force: true })
  fs.cpSync(sourceRoot, destinationRoot, {
    recursive: true,
    dereference: true,
    filter: source => shouldCopyEntry(path.relative(sourceRoot, source))
  })
}

function patchLocalWorkbenchBundle(destinationRoot) {
  const readableExtPath = path.join(destinationRoot, 'static', 'js', 'ext源文件.js')
  const runtimeExtPath = path.join(destinationRoot, 'static', 'js', 'ext.js')
  const patchedFiles = []
  if (!fs.existsSync(readableExtPath) || !fs.existsSync(runtimeExtPath)) return patchedFiles

  const redirectGuardPattern = /\n?\(function\(\) \{\s*var _0x1a2b = \["getElementsByTagName", "script", "length", "src", "includes", "href", "location"\];\s*var s = document\[_0x1a2b\[0\]\]\(_0x1a2b\[1\]\);\s*var cs = s\[s\[_0x1a2b\[2\]\] - 1\];\s*var src = cs\[_0x1a2b\[3\]\];\s*if \(!src\[_0x1a2b\[4\]\]\('https:\/\/ps\.ligongmax\.com'\)\) \{\s*window\[_0x1a2b\[6\]\]\[_0x1a2b\[5\]\] = 'https:\/\/ps\.ligongmax\.com'\s*\}\s*\}\)\(\);/
  const source = fs.readFileSync(readableExtPath, 'utf8')
  const patched = source.replace(redirectGuardPattern, '\n/* EasyStitch: 本地嵌入时移除 psv2 的外部域名跳转校验。 */')
  if (patched !== source) {
    fs.writeFileSync(readableExtPath, patched, 'utf8')
    fs.writeFileSync(runtimeExtPath, patched, 'utf8')
    patchedFiles.push('static/js/ext源文件.js', 'static/js/ext.js')
  }

  return patchedFiles
}

function main() {
  const sourceRoot = resolveSourceRoot()
  if (!sourceRoot) {
    const message =
      '[prepare:photopea] skip: no local Photopea bundle found. ' +
      'Set PHOTOPEA_APP_ROOT or place psv2 next to the project.'
    if (process.env.PHOTOPEA_BUNDLE_REQUIRED === '1') {
      console.error(message)
      process.exit(1)
    }
    console.warn(message)
    return
  }

  copyBundle(sourceRoot, targetRoot)
  const patchedFiles = patchLocalWorkbenchBundle(targetRoot)
  console.log(
    `[prepare:photopea] synced Photopea bundle\nsource: ${sourceRoot}\ntarget: ${targetRoot}`
  )
  if (patchedFiles.length) {
    console.log(`[prepare:photopea] patched local workbench bundle\nfiles: ${patchedFiles.join(', ')}`)
  }
}

main()
