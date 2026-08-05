import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
  Matches,
} from 'class-validator';

export class InvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{5}$/)
  code: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^I\d{4}I\d{11}$/)
  invoiceNumber: string;

  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  dealer: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}
