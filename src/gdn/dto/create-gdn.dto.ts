import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class GdnItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{5}$/)
  code: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateGdnDto {
  @IsString()
  @IsNotEmpty()
  gdnNumber: string;

  @IsDateString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GdnItemDto)
  items: GdnItemDto[];
}
