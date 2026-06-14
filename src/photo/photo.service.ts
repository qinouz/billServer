import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { IsNull, Repository } from 'typeorm';
import { BillType, Category } from '../category/entities/category.entity';

interface ParsedPhotoItem {
  amount: number | null;
  type?: BillType;
  category?: string | null;
  date?: string | null;
  remark?: string;
}

export interface RecognizedBillItem {
  amountCents: number | null;
  categoryId: string | null;
  categoryName: string | null;
  type: BillType;
  remark: string;
  billDate: string;
  confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class PhotoService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async recognize(userId: string, file?: any, body?: { text?: string }) {
    const categories = await this.getAvailableCategories(userId);

    if (body?.text) {
      const parsed = this.parseTextFallback(body.text);
      return { items: this.normalizeItems(parsed, categories) };
    }

    if (!file) {
      throw new BadRequestException('请上传图片文件');
    }
    if (!this.isSupportedImage(file.mimetype)) {
      throw new BadRequestException('仅支持 jpg、png、webp 图片');
    }

    const parsedItems = await this.parseImageWithMiMo(file);
    return { items: this.normalizeItems(parsedItems, categories) };
  }

  private async parseImageWithMiMo(file: any): Promise<ParsedPhotoItem[]> {
    const apiKey = this.config.get<string>('mimo.apiKey');
    if (!apiKey) {
      throw new BadRequestException('图片识别服务尚未配置 MIMO_API_KEY');
    }

    const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const today = this.formatLocalDate(new Date());
    const systemPrompt = `你是一个记账助手。今天日期是 ${today}。`;
    const userPrompt = `请从图片中提取账单信息，只返回 JSON 数组：
[
  {
    "amount": 数字金额，如果没有识别到金额则为 null,
    "type": "expense" 或 "income"，默认 "expense",
    "category": 分类名称，从支出分类“餐饮、购物、日用、交通、蔬菜、水果、零食、运动、娱乐、通讯、服饰、美容、住房、居家、孩子、长辈、社交、旅行、烟酒、数码、汽车、医疗、书籍、学习”和收入分类“工资、兼职、理财、礼金、其它”中选择，无法匹配则为 null,
    "date": "YYYY-MM-DD"，没有日期则使用今天,
    "remark": 商品、商户或其他备注
  }
]。不要返回 Markdown，不要返回解释文字。`;

    let response;
    try {
      response = await firstValueFrom(
        this.httpService.post(
          this.config.get<string>('mimo.apiUrl') ??
            'https://token-plan-cn.xiaomimimo.com/v1/chat/completions',
          {
            model: this.config.get<string>('mimo.model'),
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imageUrl } },
                  { type: 'text', text: userPrompt },
                ],
              },
            ],
            max_completion_tokens: 3048,
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
        if (error.code === 'ECONNABORTED') {
          throw new BadRequestException('图片识别服务响应超时，请稍后重试或换一张更清晰的图片');
        }
        throw new BadRequestException(`图片识别服务请求失败：${error.message}`);
      }
      throw error;
    }

    const content = this.extractResponseContent(response.data);
    const jsonText = this.extractJsonText(content);
    if (!jsonText) {
      console.warn('MiMo photo response did not contain JSON:', content.slice(0, 1000));
      throw new BadRequestException('图片解析结果格式错误');
    }

    try {
      const parsed = JSON.parse(jsonText);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      console.warn('MiMo photo response JSON parse failed:', jsonText.slice(0, 1000));
      throw new BadRequestException('图片解析结果不是合法 JSON');
    }
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

  private parseTextFallback(text: string): ParsedPhotoItem[] {
    const amountMatch = text.match(/(?:¥|￥)?\s*(\d+(?:\.\d{1,2})?)/);
    const type = /收入|工资|到账|收款|退款/.test(text)
      ? BillType.Income
      : BillType.Expense;

    return [
      {
        amount: amountMatch ? Number(amountMatch[1]) : null,
        type,
        category: this.guessCategoryName(text, type),
        date: this.extractDate(text),
        remark: text.trim(),
      },
    ];
  }

  private normalizeItems(
    parsedItems: ParsedPhotoItem[],
    categories: Category[],
  ): RecognizedBillItem[] {
    return parsedItems.map((item) => {
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

  private guessCategoryName(text: string, type: BillType) {
    if (type === BillType.Income) {
      if (/工资|薪资/.test(text)) return '工资';
      if (/兼职/.test(text)) return '兼职';
      if (/理财|收益|利息/.test(text)) return '理财';
      if (/红包|礼金/.test(text)) return '礼金';
      return '其它';
    }

    const rules: Array<[RegExp, string]> = [
      [/餐|饭|吃|咖啡|奶茶|外卖|食堂/, '餐饮'],
      [/超市|购物|淘宝|京东|拼多多/, '购物'],
      [/打车|公交|地铁|高铁|机票|停车|油费/, '交通'],
      [/菜|蔬菜/, '蔬菜'],
      [/水果/, '水果'],
      [/零食/, '零食'],
      [/药|医院|医疗/, '医疗'],
      [/书|课程|学习/, '学习'],
      [/房租|物业|水电|燃气/, '住房'],
    ];

    return rules.find(([pattern]) => pattern.test(text))?.[1] ?? '购物';
  }

  private calculateConfidence(amountCents: number | null, categoryId?: string | null) {
    if (amountCents && categoryId) return 'high';
    if (amountCents || categoryId) return 'medium';
    return 'low';
  }

  private extractDate(text: string) {
    const fullDate = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (fullDate) {
      return `${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`;
    }
    return null;
  }

  private formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isSupportedImage(mimetype: string) {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(mimetype);
  }
}
