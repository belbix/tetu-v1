import { CoreAddresses } from '../models/CoreAddresses';

export class BaseCoreAddresses {

  public static ADDRESSES = new CoreAddresses(
    '0x0bdA2d853D3F3fA7072eFFF7cEE9Eed733530bdD', // controller
    '0xA120BF4aCDB982580Fb40a5325950cC3410419A1', // announcer
    '0x7ee08267CE27DDf41a1C4Fe3850a469D9b77DB73', // bookkeeper
  );

}
