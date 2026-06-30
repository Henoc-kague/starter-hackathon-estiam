import {
  Controller,
  Get,
  Headers,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AntiScrapingGuard } from './anti-scraping.guard';
import { ThreatDetectorService } from './threat-detector.service';
import { WatermarkService } from './watermark.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller()
export class AntiScrapingController {
  constructor(
    private readonly threatDetector: ThreatDetectorService,
    private readonly watermark: WatermarkService,
  ) {}

  @UseGuards(AuthGuard, AntiScrapingGuard)
  @Get('video/:id/manifest')
  getManifest(@Param('id') id: string, @Req() req: Request & { user?: any }) {
    const userId = req.user?.username || 'utilisateur-anonyme';
    const wm = this.watermark.generate(userId, id);

    return {
      videoId: id,
      manifestUrl: `/video/${id}/stream`,
      protected: true,
      watermark: wm,
    };
  }

  @UseGuards(AuthGuard, AntiScrapingGuard)
  @Get('video/:id/stream')
  streamVideo(
    @Param('id') id: string,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    const videoPath = path.join(__dirname, '..', '..', 'public-media', 'demo-video.mp4');
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
  }

  @Get('dashboard')
  getDashboard() {
    return this.threatDetector.getDashboard();
  }

  @Get('dashboard/events')
  getEvents() {
    return { events: this.threatDetector.eventLog.slice(-200) };
  }
}
