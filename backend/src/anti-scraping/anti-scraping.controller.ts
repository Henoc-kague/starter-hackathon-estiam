import { Controller, Get, Headers, Param, UseGuards } from '@nestjs/common';
import { AntiScrapingGuard } from './anti-scraping.guard';
import { ThreatDetectorService } from './threat-detector.service';
import { WatermarkService } from './watermark.service';

@Controller()
export class AntiScrapingController {
  constructor(
    private readonly threatDetector: ThreatDetectorService,
    private readonly watermark: WatermarkService,
  ) {}

  @UseGuards(AntiScrapingGuard)
  @Get('video/:id/manifest')
  getManifest(@Param('id') id: string, @Headers('x-account-id') accountId?: string) {
    const userId = accountId || 'utilisateur-anonyme';
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
