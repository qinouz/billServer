import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/entities/category.entity';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Category])],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
