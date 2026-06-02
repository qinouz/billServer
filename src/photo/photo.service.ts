import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class PhotoService {
  recognize(_payload: Record<string, unknown>) {
    throw new BadRequestException('图片识别服务尚未配置');
  }
}
