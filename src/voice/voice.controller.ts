import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VoiceService } from './voice.service';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('recognize')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  recognize(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: any,
    @Body() body: { text?: string },
  ) {
    return this.voiceService.recognize(user.userId, file, body);
  }

  @Post('parse')
  parse(@Body('text') text: string) {
    return this.voiceService.parse(text);
  }
}
