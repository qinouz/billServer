import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/entities/category.entity';
import { PhotoController } from './photo.controller';
import { PhotoService } from './photo.service';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Category])],
  controllers: [PhotoController],
  providers: [PhotoService],
})
export class PhotoModule {}
