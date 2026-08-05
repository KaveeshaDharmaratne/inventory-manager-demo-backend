import {
  IsOptional,
  IsIn,
  IsDateString,
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 10;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['Invoice', 'Return', 'GDN'])
  type?: 'Invoice' | 'Return' | 'GDN';

  @IsOptional()
  @IsString()
  dealer?: string;

  @IsOptional()
  @IsIn(['date', 'type', 'transactionId'])
  sortBy?: 'date' | 'type' | 'transactionId' = 'date';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
