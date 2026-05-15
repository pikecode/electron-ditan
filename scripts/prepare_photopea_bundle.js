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
  console.log(
    `[prepare:photopea] synced Photopea bundle\nsource: ${sourceRoot}\ntarget: ${targetRoot}`
  )
}

main()
