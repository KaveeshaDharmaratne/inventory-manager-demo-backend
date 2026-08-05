import { IsIn, IsString } from 'class-validator';

export class GetTransactionQueryDto {
  @IsIn(['Invoice', 'Return', 'GDN'])
  type: 'Invoice' | 'Return' | 'GDN';

  @IsString()
  id: string;
}
