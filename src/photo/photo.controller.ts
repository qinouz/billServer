import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PhotoService } from './photo.service';

@Controller('photo')
@UseGuards(JwtAuthGuard)
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Post('recognize')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  recognize(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: any,
    @Body() body: { text?: string },
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.photoService
      .recognize(user.userId, file, body)
      .then((data) => {
        response
          .type('application/json; charset=utf-8')
          .send(
            escapeUnicodeJson({
              code: 0,
              data,
              message: 'success',
              path: request.originalUrl ?? request.url,
            }),
          );
      });
  }
}

function escapeUnicodeJson(payload: unknown) {
  return JSON.stringify(payload).replace(/[\u007f-\uffff]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
}
