import { Module } from '@nestjs/common';
import { ThreatDetectorService } from './threat-detector.service';
import { AntiScrapingGuard } from './anti-scraping.guard';
import { AntiScrapingController } from './anti-scraping.controller';
import { WatermarkService } from './watermark.service';
import { AnnotationsGateway } from './annotations.gateway';

@Module({
  controllers: [AntiScrapingController],
  providers: [ThreatDetectorService, AntiScrapingGuard, WatermarkService, AnnotationsGateway],
  exports: [ThreatDetectorService, WatermarkService],
})
export class AntiScrapingModule {}
