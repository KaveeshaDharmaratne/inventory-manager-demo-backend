import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiStatus(): { name: string; status: string } {
    return {
      name: 'Inventory Manager API',
      status: 'ok',
    };
  }
}
