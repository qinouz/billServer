import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(64)
  openid: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  unionid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarUrl?: string;
}
