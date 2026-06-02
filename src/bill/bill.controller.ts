import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
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
    return this.billService.findAll(String(user.userId), query);
  }

  @Get('statistic')
  statistic(@CurrentUser() user: CurrentUserPayload, @Query('year') year: string) {
    return this.billService.getStatistic(String(user.userId), Number(year));
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.billService.findOne(String(user.userId), id);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateBillDto) {
    return this.billService.create(String(user.userId), dto);
  }

  @Post('batch')
  createBatch(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ParseArrayPipe({ items: CreateBillDto }))
    dtos: CreateBillDto[],
  ) {
    return this.billService.createBatch(String(user.userId), dtos);
  }

  @Put(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBillDto,
  ) {
    return this.billService.update(String(user.userId), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.billService.remove(String(user.userId), id);
  }
}
