import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { IsNull, Repository } from 'typeorm';
import { BillType, Category } from '../category/entities/category.entity';

interface ParsedVoiceItem {
  amount: number | null;
  type?: BillType;
  category?: string | null;
  date?: string | null;
  remark?: string;
}

@Injectable()
export class VoiceService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async recognize(userId: string, file?: any, body?: { text?: string }) {
    const categories = await this.getAvailableCategories(userId);

    if (body?.text) {
      return this.normalizeResult(this.parseTextFallback(body.text), categories, body.text);
    }

    if (!file) {
      throw new BadRequestException('请上传语音文件');
    }
    if (!this.isSupportedAudio(file.mimetype)) {
      throw new BadRequestException('仅支持 mp3、wav 语音文件');
    }
    this.assertSupportedAudioContent(file);

    const recognizedText = await this.recognizeSpeechWithMiMo(file);
    if (!recognizedText) {
      return { recognizedText: '', items: [] };
    }

    const parsedItems = await this.parseTextWithMiMo(recognizedText);
    return this.normalizeResult(parsedItems, categories, recognizedText);
  }

  parse(text: string) {
    if (!text) {
      throw new BadRequestException('text 必填');
    }

    return this.normalizeResult(this.parseTextFallback(text), [], text);
  }

  private async recognizeSpeechWithMiMo(file: any) {
    const apiKey = this.config.get<string>('mimo.apiKey');
    if (!apiKey) {
      throw new BadRequestException('语音识别服务尚未配置 MIMO_API_KEY');
    }

    const audioData = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const apiUrl =
      this.config.get<string>('mimo.apiUrl') ??
      'https://token-plan-cn.xiaomimimo.com/v1/chat/completions';

    let response;
    try {
      response = await firstValueFrom(
        this.httpService.post(
          apiUrl,
          {
            model: 'mimo-v2.5-asr',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_audio',
                    input_audio: {
                      data: audioData,
                    },
                  },
                ],
              },
            ],
            asr_options: {
              language: 'zh',
            },
            stream: false,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'api-key': apiKey,
            },
            timeout: this.config.get<number>('mimo.timeoutMs') ?? 60000,
          },
        ),
      );
    } catch (error) {
      if (error instanceof AxiosError) {
        const detail = this.formatAxiosErrorDetail(error);
        console.error('MiMo ASR request failed:', {
          url: apiUrl,
          status: error.response?.status,
          mimetype: file.mimetype,
          size: file.size,
          detail,
        });
        if (error.code === 'ECONNABORTED') {
          throw new BadRequestException('语音识别服务响应超时，请稍后重试');
        }
        throw new BadRequestException(`语音识别服务请求失败：${detail}`);
      }
      throw error;
    }

    return this.extractResponseContent(response.data);
  }

  private async parseTextWithMiMo(text: string): Promise<ParsedVoiceItem[]> {
    const apiKey = this.config.get<string>('mimo.apiKey');
    if (!apiKey) {
      throw new BadRequestException('语音识别服务尚未配置 MIMO_API_KEY');
    }

    const today = this.formatLocalDate(new Date());
    const apiUrl =
      this.config.get<string>('mimo.apiUrl') ??
      'https://token-plan-cn.xiaomimimo.com/v1/chat/completions';
    const userPrompt = `你是一个记账助手，请从用户的话语中提取记账信息。

用户说："${text}"

用户可能说了多条账单，请逐条提取。只返回 JSON 数组：
[
  {
    "amount": 数字金额，如果没有识别到金额则为 null,
    "type": "expense" 或 "income"，默认 "expense",
    "category": 分类名称，从支出分类“餐饮、购物、日用、交通、蔬菜、水果、零食、运动、娱乐、通讯、服饰、美容、住房、居家、孩子、长辈、社交、旅行、烟酒、数码、汽车、医疗、书籍、学习”和收入分类“工资、兼职、理财、礼金、其它”中选择，无法匹配则为 null,
    "date": "YYYY-MM-DD"，没有日期则使用今天 ${today},
    "remark": 备注信息
  }
]

不要返回 Markdown，不要返回解释文字。`;

    let response;
    try {
      response = await firstValueFrom(
        this.httpService.post(
          apiUrl,
          {
            model: this.config.get<string>('mimo.model'),
            messages: [
              { role: 'system', content: `你是一个记账助手。今天日期是 ${today}。` },
              { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 1024,
            temperature: 0.1,
            stream: false,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'api-key': apiKey,
            },
            timeout: this.config.get<number>('mimo.timeoutMs') ?? 60000,
          },
        ),
      );
    } catch (error) {
      if (error instanceof AxiosError) {
        const detail = this.formatAxiosErrorDetail(error);
        console.error('MiMo voice parse request failed:', {
          url: apiUrl,
          status: error.response?.status,
          detail,
        });
        if (error.code === 'ECONNABORTED') {
          throw new BadRequestException('语义解析服务响应超时，请稍后重试');
        }
        throw new BadRequestException(`语义解析服务请求失败：${detail}`);
      }
      throw error;
    }

    const content = this.extractResponseContent(response.data);
    const jsonText = this.extractJsonText(content);
    if (!jsonText) {
      console.warn('MiMo voice response did not contain JSON:', content.slice(0, 1000));
      throw new BadRequestException('语义解析结果格式错误');
    }

    try {
      const parsed = JSON.parse(jsonText);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      console.warn('MiMo voice response JSON parse failed:', jsonText.slice(0, 1000));
      throw new BadRequestException('语义解析结果不是合法 JSON');
    }
  }

  private parseTextFallback(text: string): ParsedVoiceItem[] {
    const amountMatch = text.match(/\d+(?:\.\d{1,2})?/);
    const amountYuan = amountMatch ? Number(amountMatch[0]) : null;
    const type = /收入|工资|到账|收款|退款/.test(text)
      ? BillType.Income
      : BillType.Expense;

    return [
      {
        amount: amountYuan,
        type,
        category: null,
        date: null,
        remark: text,
      },
    ];
  }

  private normalizeResult(
    parsedItems: ParsedVoiceItem[],
    categories: Category[],
    recognizedText: string,
  ) {
    const items = parsedItems.map((item) => {
      const type = item.type === BillType.Income ? BillType.Income : BillType.Expense;
      const category = this.findCategory(categories, item.category, type);
      const amountYuan =
        item.amount === null || item.amount === undefined ? null : Number(item.amount);
      const amountCents =
        amountYuan !== null && Number.isFinite(amountYuan)
          ? Math.round(amountYuan * 100)
          : null;

      return {
        amountCents,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? item.category ?? null,
        type,
        remark: item.remark ?? '',
        billDate: item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
          ? item.date
          : this.formatLocalDate(new Date()),
        confidence: this.calculateConfidence(amountCents, category?.id),
      };
    });

    return { recognizedText, items };
  }

  private async getAvailableCategories(userId: string) {
    return this.categoryRepository.find({
      where: [
        { userId },
        { userId: IsNull(), isSystem: true },
      ],
      order: { type: 'ASC', sortOrder: 'ASC' },
    });
  }

  private findCategory(categories: Category[], categoryName: string | null | undefined, type: BillType) {
    if (!categoryName) {
      return null;
    }

    const scoped = categories.filter((category) => category.type === type);
    return (
      scoped.find((category) => category.name === categoryName) ??
      scoped.find(
        (category) =>
          category.name.includes(categoryName) || categoryName.includes(category.name),
      ) ??
      null
    );
  }

  private calculateConfidence(amountCents: number | null, categoryId?: string | null) {
    if (amountCents && categoryId) return 'high';
    if (amountCents || categoryId) return 'medium';
    return 'low';
  }

  private extractResponseContent(data: any): string {
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';

    if (typeof content === 'string') {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content
        .map((item) => (typeof item === 'string' ? item : item?.text ?? ''))
        .join('\n')
        .trim();
    }
    return '';
  }

  private extractJsonText(content: string) {
    const fencedJson = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedJson?.[1] ?? content;
    return candidate.match(/\[[\s\S]*\]/)?.[0] ?? candidate.match(/\{[\s\S]*\}/)?.[0];
  }

  private formatAxiosErrorDetail(error: AxiosError) {
    const data = error.response?.data;
    if (data) {
      const rawText = typeof data === 'string' ? data : JSON.stringify(data);
      const text = rawText.replace(
        /data:audio\/[^;]+;base64,[A-Za-z0-9+/=]+/g,
        'data:audio/<omitted>;base64,<omitted>',
      );
      return text.slice(0, 500);
    }
    return error.message;
  }

  private formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isSupportedAudio(mimetype: string) {
    return [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
    ].includes(mimetype);
  }

  private assertSupportedAudioContent(file: any) {
    const buffer: Buffer | undefined = file?.buffer;
    if (!buffer || buffer.length < 4) {
      throw new BadRequestException('语音文件为空或格式无效');
    }

    if (this.isWebmAudio(buffer)) {
      throw new BadRequestException(
        '当前录音实际是 webm/opus 格式，MiMo 语音识别仅支持 mp3 或 wav。请让前端录音生成 mp3/wav 后再上传。',
      );
    }

    if (file.mimetype === 'audio/wav' && !this.isWavAudio(buffer)) {
      throw new BadRequestException('语音文件内容不是有效的 wav 格式');
    }

    if (['audio/mpeg', 'audio/mp3'].includes(file.mimetype) && this.isWavAudio(buffer)) {
      file.mimetype = 'audio/wav';
    }
  }

  private isWebmAudio(buffer: Buffer) {
    return buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3;
  }

  private isWavAudio(buffer: Buffer) {
    return buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WAVE';
  }
}
