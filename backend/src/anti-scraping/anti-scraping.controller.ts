import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
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
      manifestUrl: `/segments/${id}/index.m3u8`,
      protected: true,
      watermark: wm,
    };
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
