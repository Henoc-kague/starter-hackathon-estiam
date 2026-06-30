import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Watermarking forensic — Pôle 2 Sujet B
 *
 * Pourquoi : détecter une capture d'écran côté navigateur est quasi
 * impossible de façon fiable (l'API Screen Capture, les raccourcis OS,
 * les outils tiers échappent tous au JS). Plutôt que de prétendre le
 * faire, on assume cette limite et on mise sur la dissuasion :
 * chaque session de lecture vidéo affiche un identifiant unique et
 * visible (utilisateur + timestamp + session), rendant toute fuite
 * traçable jusqu'à son origine.
 */
@Injectable()
export class WatermarkService {
  generate(userId: string, videoId: string): { text: string; sessionToken: string } {
    const timestamp = new Date().toISOString();
    const sessionToken = createHash('sha256')
      .update(`${userId}-${videoId}-${timestamp}`)
      .digest('hex')
      .slice(0, 12);

    return {
      text: `${userId} · ${timestamp} · ${sessionToken}`,
      sessionToken,
    };
  }
}
