import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VoiceService } from './voice.service';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('recognize')
  recognize(@Body() body: Record<string, unknown>) {
    return this.voiceService.recognize(body);
  }

  @Post('parse')
  parse(@Body('text') text: string) {
    return this.voiceService.parse(text);
  }
}
