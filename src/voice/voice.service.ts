import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class VoiceService {
  recognize(_payload: Record<string, unknown>) {
    throw new BadRequestException('语音识别服务尚未配置');
  }

  parse(text: string) {
    if (!text) {
      throw new BadRequestException('text 必填');
    }

    const amountMatch = text.match(/\\d+(?:\\.\\d{1,2})?/);
    return {
      text,
      amount: amountMatch ? Number(amountMatch[0]) : null,
      type: text.includes('收入') ? 'income' : 'expense',
      remark: text,
    };
  }
}
