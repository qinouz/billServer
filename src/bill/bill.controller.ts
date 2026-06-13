import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BillService } from './bill.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { QueryBillDto } from './dto/query-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';

@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillController {
  constructor(private readonly billService: BillService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryBillDto) {
    return this.billService.findAll(user.userId, query);
  }

  @Get('statistic')
  statistic(@CurrentUser() user: CurrentUserPayload, @Query('year') year: string) {
    return this.billService.getStatistic(user.userId, Number(year));
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.billService.findOne(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateBillDto) {
    return this.billService.create(user.userId, dto);
  }

  @Post('batch')
  createBatch(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: CreateBillDto[] | { items?: Array<CreateBillDto & { categoryName?: string }> },
  ) {
    const dtos = Array.isArray(body) ? body : body.items;
    return this.billService.createBatch(user.userId, dtos);
  }

  @Put(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBillDto,
  ) {
    return this.billService.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.billService.remove(user.userId, id);
  }
}
