import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PhotoService } from './photo.service';

@Controller('photo')
@UseGuards(JwtAuthGuard)
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Post('recognize')
  recognize(@Body() body: Record<string, unknown>) {
    return this.photoService.recognize(body);
  }
}
