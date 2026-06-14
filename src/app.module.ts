import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { BillModule } from './bill/bill.module';
import { CategoryModule } from './category/category.module';
import { PhotoModule } from './photo/photo.module';
import { HealthModule } from './health/health.module';
import { ReminderModule } from './reminder/reminder.module';
import { StatisticsModule } from './statistics/statistics.module';
import { UserModule } from './user/user.module';
import { VoiceModule } from './voice/voice.module';

const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV;
const envFilePath = [
  ...(appEnv ? [`.env.${appEnv}`] : []),
  '.env',
  '.env.example',
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        charset: 'utf8mb4',
        autoLoadEntities: true,
        synchronize: config.get<boolean>('database.synchronize'),
      }),
    }),
    AuthModule,
    HealthModule,
    UserModule,
    BillModule,
    CategoryModule,
    StatisticsModule,
    VoiceModule,
    PhotoModule,
    ReminderModule,
  ],
})
export class AppModule {}
