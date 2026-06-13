import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class SaveReminderDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  reminderTime: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
