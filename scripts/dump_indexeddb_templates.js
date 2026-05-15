const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')

const tempHtml = path.join(os.tmpdir(), 'easystitch-idb-dump.html')
const userDataPath = path.join(app.getPath('appData'), 'EasyStitch')

app.setName('EasyStitch')
app.setPath('userData', userDataPath)

fs.writeFileSync(
  tempHtml,
  '<!doctype html><html><head><meta charset="utf-8"></head><body>dump</body></html>',
  'utf8'
)

function dumpTemplatesInRenderer() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('easystitch_local')
    request.onerror = () => reject(request.error || new Error('indexeddb-open-failed'))
    request.onsuccess = async () => {
      try {
        const db = request.result
        const names = Array.from(db.objectStoreNames || [])
        if (!names.includes('templates')) {
          resolve({ stores: names, templates: [] })
          return
        }

        const tx = db.transaction(names.filter((name) => ['templates', 'template_blobs'].includes(name)), 'readonly')
        const templatesReq = tx.objectStore('templates').getAll()
        const templates = await new Promise((res, rej) => {
          templatesReq.onsuccess = () => res(Array.isArray(templatesReq.result) ? templatesReq.result : [])
          templatesReq.onerror = () => rej(templatesReq.error || new Error('templates-getall-failed'))
        })

        const blobStore = names.includes('template_blobs') ? tx.objectStore('template_blobs') : null
        const summarized = []
        for (const template of templates) {
          let blobInfo = null
          if (blobStore && template?.id) {
            const blobReq = blobStore.get(template.id)
            const blobRecord = await new Promise((res, rej) => {
              blobReq.onsuccess = () => res(blobReq.result || null)
              blobReq.onerror = () => rej(blobReq.error || new Error('blob-get-failed'))
            })
            const blob = blobRecord?.blob
            if (blob instanceof Blob) {
              const signatureBuffer = await blob.slice(0, 4).arrayBuffer()
              const signature = Array.from(new Uint8Array(signatureBuffer))
                .map((value) => String.fromCharCode(value))
                .join('')
              blobInfo = {
                size: blob.size,
                type: blob.type || '',
                signature
              }
            }
          }

          summarized.push({
            id: template?.id || '',
            name: template?.name || '',
            format: template?.format || '',
            width: Number(template?.width || 0) || 0,
            height: Number(template?.height || 0) || 0,
            uploadTime: template?.uploadTime || '',
            meta: template?.meta || {},
            blobInfo
          })
        }

        resolve({
          stores: names,
          templates: summarized
        })
      } catch (error) {
        reject(error)
      }
    }
  })
}

async function main() {
  await app.whenReady()
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: false,
      sandbox: false
    }
  })

  try {
    await win.loadFile(tempHtml)
    const result = await win.webContents.executeJavaScript(`(${dumpTemplatesInRenderer.toString()})()`, true)
    process.stdout.write(JSON.stringify(result, null, 2))
  } finally {
    win.destroy()
    app.quit()
  }
}

main().catch((error) => {
  console.error(error)
  app.exit(1)
})
