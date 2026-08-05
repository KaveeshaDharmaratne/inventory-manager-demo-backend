import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { ReturnItem } from '../../returns/entities/return-item.entity';

@Entity('item')
export class Item {
  @PrimaryColumn({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ type: 'integer', nullable: true, default: 0 })
  quantity: number;

  @OneToMany(() => ReturnItem, (returnItem) => returnItem.item)
  returnItems: ReturnItem[];
}
