'use strict'

const path = require('path')
const fs = require('fs')
const promisify = require('node-promisify')

const fsWrite = promisify(fs.writeFile)
const mkdirp = promisify(require('mkdirp'))

function toUrl (localPath) {
  if (path.sep === '\\') {
    return localPath.replace(/\\/g, '\/')
  }
  return localPath
}

function rebase(result) {
  if (result.isRelative()) {
    result.url = toUrl(path.relative(
      path.dirname(result.to), result.file
    ))
  }
}

function inline(result, opts) {
  opts = opts || {}
  let asset = result.asset
  if (!result.isRelative() || !asset.mimeType) {
    return
  }

  let maxSize = opts.maxSize === undefined ? 10 : opts.maxSize
  maxSize <<= 10

  return asset.size()
    .then(function (size) {
      if (size >= maxSize) return

      return asset.dataUrl()
        .then(function (dataUrl) {
          result.url = dataUrl
        })
    })
}

function copy(result, opts) {
  if (!result.isRelative()) return

  opts = opts || {}
  let assetFolder = opts.assetOutFolder
  if (typeof assetFolder === 'function') {
    assetFolder = assetFolder(result.file, result.opts)
  }
  if (typeof assetFolder === 'string') {
    assetFolder = path.resolve(assetFolder)
  } else {
    assetFolder = path.dirname(
      path.resolve(path.dirname(result.to), result.url)
    )
  }

  return mkdirp(assetFolder)
    .then(function () {
      return opts.useHash ? '[hash]' : opts.name
    })
    .then(function (name) {
      let ext = path.extname(result.file)
      let basename = path.basename(result.file, ext)
      if (name && /\[name\]/.test(name)) {
        name = name.replace(/\[name\]/g, basename)
      }
      if (name && /\[hash\]/.test(name)) {
        return result.asset.shasum().then(function (shasum) {
          return name.replace(/\[hash\]/g, shasum.slice(0, 7)) + ext
        })
      }
      return name || basename + ext
    })
    .then(function (basename) {
      let assetFile = path.join(assetFolder, basename)
      if (opts.baseUrl) {
        result.url = toUrl(path.join(opts.baseUrl, basename))
      } else {
        result.url = toUrl(path.relative(
          path.dirname(result.to), assetFile
        ))
      }
      return result.asset.data().then(function (buf) {
        return fsWrite(assetFile, buf)
      })
    })
}

module.exports = {
  rebase: rebase,
  inline: inline,
  copy: copy,
}

