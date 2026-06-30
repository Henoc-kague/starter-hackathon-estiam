import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AntiScrapingGuard } from './anti-scraping.guard';
import { ThreatDetectorService } from './threat-detector.service';

@Controller()
export class AntiScrapingController {
  constructor(private readonly threatDetector: ThreatDetectorService) {}

  @UseGuards(AntiScrapingGuard)
  @Get('video/:id/manifest')
  getManifest(@Param('id') id: string) {
    return {
      videoId: id,
      manifestUrl: `/segments/${id}/index.m3u8`,
      protected: true,
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
