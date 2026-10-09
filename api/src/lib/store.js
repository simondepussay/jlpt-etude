// Stockage Azure Blob : un dossier par utilisateur.
//   users/<uid>/profile.json
//   users/<uid>/progress-<NIVEAU>.json
// Les ETag permettent d'éviter qu'un appareil écrase les données d'un autre.
const { BlobServiceClient } = require("@azure/storage-blob");

let container = null;
async function getContainer() {
  if (container) return container;
  const conn = process.env.STORAGE_CONNECTION;
  if (!conn) throw Object.assign(new Error("Serveur mal configuré (STORAGE_CONNECTION)"), { status: 500 });
  const c = BlobServiceClient.fromConnectionString(conn).getContainerClient("jlpt");
  await c.createIfNotExists();
  container = c;
  return c;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const ch of stream) chunks.push(typeof ch === "string" ? Buffer.from(ch) : ch);
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(path) {
  const blob = (await getContainer()).getBlockBlobClient(path);
  try {
    const res = await blob.download();
    return { data: JSON.parse(await streamToString(res.readableStreamBody)), etag: res.etag };
  } catch (e) {
    if (e.statusCode === 404) return null;
    throw e;
  }
}

// ifMatch : ETag connu ; null = création seulement (échoue si le fichier existe déjà)
async function writeJson(path, data, ifMatch) {
  const blob = (await getContainer()).getBlockBlobClient(path);
  const body = JSON.stringify(data);
  const conditions = ifMatch ? { ifMatch } : ifMatch === null ? { ifNoneMatch: "*" } : {};
  try {
    const res = await blob.upload(body, Buffer.byteLength(body), {
      conditions,
      blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" }
    });
    return { etag: res.etag };
  } catch (e) {
    if (e.statusCode === 412 || e.statusCode === 409) return { conflict: true };
    throw e;
  }
}

async function deletePrefix(prefix) {
  const c = await getContainer();
  let n = 0;
  for await (const b of c.listBlobsFlat({ prefix })) {
    await c.deleteBlob(b.name);
    n++;
  }
  return n;
}

module.exports = { readJson, writeJson, deletePrefix };
