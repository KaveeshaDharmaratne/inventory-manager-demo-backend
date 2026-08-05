import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Return } from './return.entity';
import { Item } from '../../item/entities/item.entity';

@Entity('return_item')
export class ReturnItem {
  @PrimaryColumn({ name: 'return_id', type: 'varchar' })
  returnId: string;

  @PrimaryColumn({ name: 'item_code', type: 'varchar' })
  itemCode: string;

  @Column({ type: 'integer' })
  quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'modified_at', type: 'timestamp' })
  modifiedAt: Date;

  @ManyToOne(() => Return, (ret) => ret.items)
  @JoinColumn({ name: 'return_id' })
  return: Return;

  @ManyToOne(() => Item, (item) => item.returnItems)
  @JoinColumn({ name: 'item_code' })
  item: Item;
}
