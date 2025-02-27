import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import * as path from 'path';

const locks = new Map<string, Promise<void>>(); //Lock per la concorrenza
const chunkCounter = new Map<string, number>(); //Conta i chunk ricevuti

@Controller()
export class AppController {
  constructor() {}

  @Post('stream')
  async uploadFile(@Req() req: Request, @Res() res: Response) {
    try {
      const fileId = req.headers['x-file-id'] as string;
      const fileName = req.headers['x-file-name'] as string;
      const chunkIndex = parseInt(req.headers['x-chunk-index'] as string);
      const totalChunks = parseInt(req.headers['x-total-chunks'] as string);

      if (!fileId || !fileName || isNaN(chunkIndex) || isNaN(totalChunks)) {
        return res
          .status(400)
          .send(
            'Intestazioni X-File-ID, X-File-Name, X-Chunk-Index e X-Total-Chunks richieste',
          );
      }

      const uploadDir = './uploads';
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, `${fileId}_${fileName}`);

      // 🔒 Lock per evitare scrittura concorrente
      const previousLock = locks.get(filePath) || Promise.resolve();
      const lock = previousLock.then(() =>
        this.writeChunk(req, filePath, chunkIndex, totalChunks),
      );

      locks.set(filePath, lock);

      await lock;
      res.status(200).send('Chunk ricevuto');
    } catch (error) {
      console.error('Errore:', error);
      res.status(500).send("Errore durante l'upload.");
    }
  }

  private async writeChunk(
    req: Request,
    filePath: string,
    chunkIndex: number,
    totalChunks: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = createWriteStream(filePath, { flags: 'a' });

      req.pipe(writeStream);

      req.on('end', () => {
        console.log(`Chunk ${chunkIndex} salvato per ${filePath}`);

        //Incrementa il contatore dei chunk ricevuti
        const receivedChunks = (chunkCounter.get(filePath) || 0) + 1;
        chunkCounter.set(filePath, receivedChunks);

        // Se tutti i chunk sono arrivati, rimuoviamo il file dalla mappa
        if (receivedChunks >= totalChunks) {
          console.log(`Upload completato per ${filePath}`);
          locks.delete(filePath);
          chunkCounter.delete(filePath);
        }

        resolve();
      });

      req.on('error', (err) => {
        console.error("Errore nell'upload:", err);
        reject(err);
      });
    });
  }
}
