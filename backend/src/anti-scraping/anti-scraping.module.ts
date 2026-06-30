import { Module } from '@nestjs/common';
import { ThreatDetectorService } from './threat-detector.service';
import { AntiScrapingGuard } from './anti-scraping.guard';
import { AntiScrapingController } from './anti-scraping.controller';
import { WatermarkService } from './watermark.service';

@Module({
  controllers: [AntiScrapingController],
  providers: [ThreatDetectorService, AntiScrapingGuard, WatermarkService],
  exports: [ThreatDetectorService, WatermarkService],
})
export class AntiScrapingModule {}
