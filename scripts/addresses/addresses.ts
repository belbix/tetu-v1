import { CoreAddresses } from '../models/CoreAddresses';
import { BaseCoreAddresses } from './addresses_core_base';


export class Addresses {

  public static CORE = new Map<string, CoreAddresses>([
    ['8453', BaseCoreAddresses.ADDRESSES],
  ]);
}
