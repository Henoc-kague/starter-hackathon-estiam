import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { AntiScrapingModule } from './anti-scraping/anti-scraping.module'
@Module({
  imports: [AuthModule, AntiScrapingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
