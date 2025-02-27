import * as fs from 'fs';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

async function uploadFileInChunks(filePath: string, chunkSize = 1024 * 1024) {
  const fileId = randomUUID(); // 🔹 ID univoco per l'upload
  const fileName = filePath.split('/').pop();
  const fileStat = fs.statSync(filePath); // 📏 Ottieni la dimensione del file
  const totalChunks = Math.ceil(fileStat.size / chunkSize); // 🔢 Calcola il numero totale di chunk

  const fileStream = fs.createReadStream(filePath, {
    highWaterMark: chunkSize,
  });

  let chunkIndex = 0;

  for await (const chunk of fileStream) {
    console.log(
      `📤 Inviando chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} byte)`,
    );

    await fetch('http://localhost:3000/stream', {
      method: 'POST',
      headers: {
        'x-file-id': fileId,
        'x-file-name': fileName,
        'x-chunk-index': chunkIndex.toString(),
        'x-total-chunks': totalChunks.toString(), // 🔢 Invia il numero totale di chunk
        'x-chunk-size': chunk.length.toString(),
      },
      body: chunk, // 🔹 Invia il chunk
    });

    chunkIndex++;
  }

  console.log('✅ Upload completato!');
}

uploadFileInChunks('./100MB.bin');
